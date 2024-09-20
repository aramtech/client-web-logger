import {
    __DEV__,
    GLOBAL_LOG_LEVEL,
    LOG_IN_PRODUCTION,
    log_remotely,
    REMOTE_LOG_ADDRESS,
    REMOTE_LOG_APP_ID,
    REMOTE_LOG_LOG_EVENT_NAME,
    REMOTE_LOG_SOCKET_PATH
} from "@/env";
import { io } from "socket.io-client";

const showLogs = __DEV__ || LOG_IN_PRODUCTION;

const baseLogger = {
    ...console,
};

const colors = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    console_color: "\x1b[0m",
};

type LogLevel = "Debug" | "Info" | "Warning" | "Error" | "Critical";

const logLevelPriorityMap = {
    Debug: 0,
    Info: 1,
    Warning: 2,
    Error: 3,
    Critical: 4,
};

export const allowedBaseLogMethods = {
    log: true,
    info: true,
    error: true,
    warn: true,
    trace: true,
    debug: true,
};

type LogProps = {
    msgs: any[];
    logMethodName: keyof typeof allowedBaseLogMethods;
    color: keyof typeof colors;
    baseLevel: LogLevel;
    level: LogLevel;
    name: string;
    logToConsole: boolean;
};

const log = ({ msgs, logMethodName = "log", color, baseLevel, level, name, logToConsole }: LogProps) => {
    if (!showLogs || !logToConsole) {
        return;
    }

    if (logLevelPriorityMap[baseLevel] > logLevelPriorityMap[level]) {
        return;
    }

    const l = baseLogger[logMethodName];

    if (!msgs[0]) {
        l();
        return;
    }
    l(
        `${colors[color]}---[${new Date().toLocaleTimeString()}]-[ ${String(name).toUpperCase()} ]-[ ${String(
            level
        ).toUpperCase()} ]---${colors.console_color}`,
        ...msgs
    );
};

function get_os() {
    const userAgent = window.navigator.userAgent;

    if (userAgent.indexOf("Win") !== -1) {
        return "Windows";
    } else if (userAgent.indexOf("Mac") !== -1) {
        return "MacOS";
    } else if (userAgent.indexOf("X11") !== -1 || userAgent.indexOf("Linux") !== -1) {
        return "Linux";
    } else if (userAgent.indexOf("Android") !== -1) {
        return "Android";
    } else if (userAgent.indexOf("like Mac") !== -1) {
        return "iOS";
    }

    return "Unknown OS";
}
let remoteLog = (logProps: LogProps) => {};

if (process.env.NODE_ENV !== "test") {
    baseLogger.log("creating remote logger connection");
    const clientInfo = {
        systemName: get_os(),
        userAgent: navigator.userAgent, 
        platform: "Web",
        isEmulator: false,
    };
    const remoteLogConnectionProps = {
        query: { clientInfo: JSON.stringify(clientInfo), appID: REMOTE_LOG_APP_ID }, // Send client info during connection
        autoConnect: true,
        transports: ["websocket"],
        path: REMOTE_LOG_SOCKET_PATH,
    };
    baseLogger.log("remoteLogConnectionProps", remoteLogConnectionProps);
    const socket = io(REMOTE_LOG_ADDRESS, remoteLogConnectionProps);

    socket.on("connect", () => {
        baseLogger.log("connected to remote logger");
    });
    socket.on("error", error => {
        baseLogger.log("Error connecting to remote Logger", error);
    });
    remoteLog = logProps => {
        socket.emit(REMOTE_LOG_LOG_EVENT_NAME, logProps);
    };
}

const processLog = (logProps: LogProps) => {
    if (log_remotely.value) {
        remoteLog(logProps);
    }
    log(logProps);
};

function local_log_decorator(
    name: string,
    color: keyof typeof colors,
    logToConsole = true,
    logLevel: LogLevel = "Debug"
) {
    if (process.env.NODE_ENV === "test") {
        const log = console.log;
        const logger = Object.assign(log, {
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug,
            trace: console.trace,
            warning: console.warn,
            critical: console.error,
        });
        return logger;
    }

    const logger = function (...args: any[]) {
        processLog({
            baseLevel: logLevel,
            color: color,
            level: "Info",
            logMethodName: "log",
            logToConsole: logToConsole,
            msgs: args,
            name: name,
        });
    };

    logger.error = function (...args: any[]) {
        processLog({
            baseLevel: logLevel,
            color: "red",
            level: "Error",
            logMethodName: "error",
            logToConsole: logToConsole,
            msgs: args,
            name: name,
        });
    };

    logger.info = function (...args: any[]) {
        processLog({
            baseLevel: logLevel,
            color: "blue",
            level: "Info",
            logMethodName: "info",
            logToConsole: logToConsole,
            msgs: args,
            name: name,
        });
    };

    logger.warning = function (...args: any[]) {
        processLog({
            baseLevel: logLevel,
            color: "yellow",
            level: "Warning",
            logMethodName: "warn",
            logToConsole: logToConsole,
            msgs: args,
            name: name,
        });
    };
    logger.debug = function (...args: any[]) {
        processLog({
            baseLevel: logLevel,
            color: "cyan",
            level: "Debug",
            logMethodName: "debug",
            logToConsole: logToConsole,
            msgs: args,
            name: name,
        });
    };

    logger.critical = function (...args: any[]) {
        processLog({
            baseLevel: logLevel,
            color: "red",
            level: "Critical",
            logMethodName: "error",
            logToConsole: logToConsole,
            msgs: args,
            name: name,
        });
    };

    return logger;
}

if (process.env.NODE_ENV !== "test") {
    
    console.log = (...args: any) =>
        processLog({
            baseLevel: GLOBAL_LOG_LEVEL,
            level: "Info",
            color: "white",
            logMethodName: "log",
            logToConsole: true,
            msgs: args,
            name: "GENERAL",
        });

    console.info = (...args: any) =>
        processLog({
            baseLevel: GLOBAL_LOG_LEVEL,
            level: "Info",
            color: "white",
            logMethodName: "info",
            logToConsole: true,
            msgs: args,
            name: "GENERAL",
        });

    console.trace = (...args: any) =>
        processLog({
            baseLevel: GLOBAL_LOG_LEVEL,
            level: "Info",
            color: "white",
            logMethodName: "trace",
            logToConsole: true,
            msgs: args,
            name: "GENERAL",
        });

    console.warn = (...args: any) =>
        processLog({
            baseLevel: GLOBAL_LOG_LEVEL,
            level: "Warning",
            color: "yellow",
            logMethodName: "warn",
            logToConsole: true,
            msgs: args,
            name: "GENERAL",
        });
    console.debug = (...args: any) =>
        processLog({
            baseLevel: GLOBAL_LOG_LEVEL,
            level: "Debug",
            color: "blue",
            logMethodName: "debug",
            logToConsole: true,
            msgs: args,
            name: "GENERAL",
        });

    console.error = (...args: any) =>
        processLog({
            baseLevel: GLOBAL_LOG_LEVEL,
            level: "Error",
            color: "red",
            logMethodName: "error",
            logToConsole: true,
            msgs: args,
            name: "GENERAL",
        });
}

export { local_log_decorator };
export default local_log_decorator;
