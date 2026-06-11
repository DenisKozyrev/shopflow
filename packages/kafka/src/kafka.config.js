"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kafkaConfig = void 0;
const kafkaConfig = () => ({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'shopflow',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    retry: {
        initialRetryTime: 300,
        retries: 8,
    },
});
exports.kafkaConfig = kafkaConfig;
//# sourceMappingURL=kafka.config.js.map