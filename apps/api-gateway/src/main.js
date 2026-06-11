"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const logger = new common_1.Logger("Bootstrap");
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:3001",
        credentials: true,
    });
    app.setGlobalPrefix("api/v1");
    const port = process.env.API_GATEWAY_PORT ?? 3000;
    await app.listen(port);
    logger.log(`API Gateway running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map