"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const token_service_1 = require("./token.service");
let AuthService = class AuthService {
    constructor(tokenService) {
        this.tokenService = tokenService;
    }
    async validateToken(token) {
        try {
            const payload = await this.tokenService.verifyAccessToken(token);
            return {
                valid: true,
                userId: payload.sub,
                email: payload.email,
                role: payload.role,
            };
        }
        catch {
            return { valid: false, userId: '', email: '', role: '' };
        }
    }
    async getUserById(userId) {
        // TODO: implement with Prisma in Sprint 1
        throw new Error('Not implemented');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof token_service_1.TokenService !== "undefined" && token_service_1.TokenService) === "function" ? _a : Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map