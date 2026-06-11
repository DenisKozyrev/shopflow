"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('AuthService');
    const app = await core_1.NestFactory.createMicroservice(app_module_1.AppModule, {
        transport: microservices_1.Transport.GRPC,
        options: {
            package: 'auth',
            protoPath: (0, path_1.join)(__dirname, '../../../../packages/proto/proto/auth.proto'),
            url: `0.0.0.0:${process.env.AUTH_GRPC_PORT ?? 5001}`,
        },
    });
    await app.listen();
    logger.log(`Auth Service gRPC listening on port ${process.env.AUTH_GRPC_PORT ?? 5001}`);
}
bootstrap();
//# sourceMappingURL=main.js.map