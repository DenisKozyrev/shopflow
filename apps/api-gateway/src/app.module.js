"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const microservices_1 = require("@nestjs/microservices");
const path_1 = require("path");
const common_2 = require("@shopflow/common");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
            // gRPC client connections to microservices
            microservices_1.ClientsModule.register([
                {
                    name: common_2.GRPC_SERVICE_TOKENS.AUTH_SERVICE,
                    transport: microservices_1.Transport.GRPC,
                    options: {
                        package: 'auth',
                        protoPath: (0, path_1.join)(__dirname, '../../../../packages/proto/proto/auth.proto'),
                        url: `localhost:${process.env.AUTH_GRPC_PORT ?? 5001}`,
                    },
                },
                {
                    name: common_2.GRPC_SERVICE_TOKENS.PRODUCT_SERVICE,
                    transport: microservices_1.Transport.GRPC,
                    options: {
                        package: 'product',
                        protoPath: (0, path_1.join)(__dirname, '../../../../packages/proto/proto/product.proto'),
                        url: `localhost:${process.env.PRODUCT_GRPC_PORT ?? 5002}`,
                    },
                },
                {
                    name: common_2.GRPC_SERVICE_TOKENS.ORDER_SERVICE,
                    transport: microservices_1.Transport.GRPC,
                    options: {
                        package: 'order',
                        protoPath: (0, path_1.join)(__dirname, '../../../../packages/proto/proto/order.proto'),
                        url: `localhost:${process.env.ORDER_GRPC_PORT ?? 5003}`,
                    },
                },
            ]),
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map