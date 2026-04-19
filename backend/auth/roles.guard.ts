import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Пользователь не найден (нет сессии)');
    }

    const hasRole = Array.isArray(user.role) 
      ? requiredRoles.some((role) => user.role.includes(role)) 
      : requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException('Доступ запрещен. Требуются права администратора.');
    }
    return true;
  }
}
