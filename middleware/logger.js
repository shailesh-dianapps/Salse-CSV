const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '..', 'logs');
if(!fs.existsSync(logDir)){
    fs.mkdirSync(logDir, {recursive: true});
}

const logFormat = winston.format.combine(
    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
);

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error'
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log')
        }),
        // Console output (colorized)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({filename: path.join(logDir, 'exceptions.log')})
    ]
});

// Middleware for logging requests
const requestLogger = (req, res, next) => {
    logger.info(`[REQUEST] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
};

// Middleware for logging errors
const errorLogger = (err, req, res, next) => {
    logger.error(`[ERROR] ${req.method} ${req.originalUrl} - ${err.message}`);
    if(process.env.NODE_ENV !== 'production'){
        console.error(err.stack);
    }
    next(err);
};

module.exports = {logger, requestLogger, errorLogger};
