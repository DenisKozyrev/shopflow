import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Response } from 'express';

// Errors surfaced by @nestjs/microservices' gRPC client are plain objects shaped
// like { code, details, metadata } straight from @grpc/grpc-js — NOT instances of
// Nest's RpcException (that class is for the server side, thrown inside a
// @GrpcMethod handler; the client side never wraps the error, see
// ClientProxy.serializeError() in @nestjs/microservices, which is a no-op passthrough).
interface GrpcError {
  code: number;
  details?: string;
  message?: string;
}

function isGrpcError(exception: unknown): exception is GrpcError {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    typeof (exception as Record<string, unknown>).code === 'number'
  );
}

const GRPC_TO_HTTP_STATUS: Partial<Record<number, HttpStatus>> = {
  [GrpcStatus.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [GrpcStatus.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [GrpcStatus.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [GrpcStatus.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [GrpcStatus.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
};

// Extends BaseExceptionFilter (Nest's own default filter) instead of implementing
// ExceptionFilter from scratch, so anything that isn't a gRPC error — HttpException
// from ValidationPipe/AuthGuard, an unexpected bug — falls through to Nest's normal
// handling via super.catch() instead of being silently swallowed or mis-shaped.
@Catch()
export class GrpcExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!isGrpcError(exception)) {
      super.catch(exception, host);
      return;
    }

    const httpStatus = GRPC_TO_HTTP_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const response = host.switchToHttp().getResponse<Response>();

    response.status(httpStatus).json({
      statusCode: httpStatus,
      message: exception.details ?? exception.message ?? 'Unexpected error',
    });
  }
}
