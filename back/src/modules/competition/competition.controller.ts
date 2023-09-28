import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CompetitionService } from './competition.service';
import fs from 'fs/promises';
import process from 'process';
import * as fse from 'fs-extra';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageObjectDto } from './dtos/storage-object.dto';
import { TerminalDto } from './dtos/terminal.dto';
import extract from 'extract-zip';
const util = require('util');

@Controller('Competitions')
@ApiTags('competitions')
export class CompetitionController {
  constructor(public service: CompetitionService) {}

  @Post('/submit/:username/:password')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async submit(
    @Body() data: StorageObjectDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<TerminalDto[]> {
    data.file = file;

    const login = await this.service.authService.loginUserEmailPass({
      email: data.email,
      password: data.password,
    });
    if (!login) throw new UnauthorizedException('Invalid credentials');

    const user = await this.service.userService.findOne({
      where: { email: data.email },
    });

    if (file.mimetype !== 'application/zip')
      throw new Error('Invalid file type');

    // rename the file as datetime.zip
    // store the zip file in the user's folder username/zips
    await fs.mkdir('submissions/' + data.email + '/zips', {
      recursive: true,
    });
    const zipPath =
      'submissions/' + data.email + '/zips/' + this.service.getDate() + '.zip';
    await fs.writeFile(zipPath, data.file.buffer);
    const sourceFolder = process.cwd() + '/submissions/' + data.email + '/src';

    // clear the user's folder username/src
    await fs.rm(sourceFolder, { recursive: true, force: true });
    await fs.mkdir(sourceFolder, { recursive: true });

    // unzip the file into the user's folder username/src
    await extract(zipPath, { dir: sourceFolder });

    // copy the tests folder, main.cpp, cmakefile, functions.h, functions.cpp to the user's folder username/src
    await fse.copy('../tests', sourceFolder + '/tests', { overwrite: true });
    await fse.copy('../main.cpp', sourceFolder + '/main.cpp', {
      overwrite: true,
    });
    await fse.copy('../CMakeLists.txt', sourceFolder + '/CMakeLists.txt', {
      overwrite: true,
    });
    await fse.copy('../functions.h', sourceFolder + '/functions.h', {
      overwrite: true,
    });
    await fse.copy('../IAgent.h', sourceFolder + '/IAgent.h', {
      overwrite: true,
    });
    const outs: TerminalDto[] = [];
    // compile the users code
    outs.push(
      await this.service.runCommand(
        'cmake -S ' + sourceFolder + ' -B ' + sourceFolder + '/build',
      ),
    );
    outs.push(
      await this.service.runCommand('cmake --build ' + sourceFolder + '/build'),
    );
    // run automated tests
    outs.push(
      await this.service.runCommand(
        'cmake --build ' +
          sourceFolder +
          '/build --target StudentSimulation-test',
      ),
    );
    // store the compiled code in the user's folder username/
    if (await fse.existsSync(sourceFolder + '/build/StudentSimulation'))
      await fse.copy(
        sourceFolder + '/build/StudentSimulation',
        sourceFolder + '/../StudentSimulation',
        { overwrite: true },
      );
    // return error or success
    return outs;
  }
}
