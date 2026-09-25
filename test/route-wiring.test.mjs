import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { Module, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DescopeSessionGuard } from '../dist/auth/descope-session.guard.js';
import { DescopeService } from '../dist/auth/descope.service.js';
import { PrismaService } from '../dist/database/prisma.service.js';
import { StatisticalSpacesController } from '../dist/statistical-spaces/statistical-spaces.controller.js';
import { StatisticalSpacesRepository } from '../dist/statistical-spaces/statistical-spaces.repository.js';
import { StatisticalSpacesService } from '../dist/statistical-spaces/statistical-spaces.service.js';
import { CreateSpaceDto } from '../dist/statistical-spaces/statistical-spaces.dto.js';
import { UsersController } from '../dist/users/users.controller.js';
import { UsersRepository } from '../dist/users/users.repository.js';
import { UsersService } from '../dist/users/users.service.js';
import { UpdateProfileDto } from '../dist/users/users.dto.js';
import { createUsersTestContext } from './support/users-test-context.mjs';

test('los controladores Nest arrancan con dependencias aisladas y rutas protegidas', async () => {
  const context = await createUsersTestContext();
  let app;

  try {
    class TestModule {}
    Module({
      controllers: [UsersController, StatisticalSpacesController],
      providers: [
        DescopeSessionGuard,
        UsersRepository,
        UsersService,
        StatisticalSpacesRepository,
        StatisticalSpacesService,
        { provide: PrismaService, useValue: context.prisma },
        {
          provide: DescopeService,
          useValue: {
            validateSession: async () => {
              throw new Error('No usado');
            },
          },
        },
      ],
    })(TestModule);

    app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    assert.ok(app.get(UsersController));
    assert.ok(app.get(StatisticalSpacesController));

    for (const [controller, method, path, verb] of [
      [UsersController, 'getCurrentUser', 'me', RequestMethod.GET],
      [UsersController, 'provisionCurrentUser', 'me', RequestMethod.PUT],
      [UsersController, 'updateCurrentUser', 'me', RequestMethod.PATCH],
      [StatisticalSpacesController, 'findAll', '/', RequestMethod.GET],
      [StatisticalSpacesController, 'create', '/', RequestMethod.POST],
    ]) {
      const handler = controller.prototype[method];
      assert.ok(
        Reflect.getMetadata(GUARDS_METADATA, handler)?.includes(
          DescopeSessionGuard,
        ),
      );
      assert.equal(Reflect.getMetadata(PATH_METADATA, handler), path);
      assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), verb);
    }

    assert.ok(
      Reflect.getMetadata(
        'design:paramtypes',
        UsersController.prototype,
        'updateCurrentUser',
      )?.includes(UpdateProfileDto),
    );
    assert.ok(
      Reflect.getMetadata(
        'design:paramtypes',
        StatisticalSpacesController.prototype,
        'create',
      )?.includes(CreateSpaceDto),
    );
  } finally {
    if (app) await app.close();
    await context.close();
  }
});
