import { InjectRepository } from '@nestjs/typeorm';
import { ErrorLog } from './error-log.entity';
import { Injectable } from '@nestjs/common';
import { MongoRepository } from 'typeorm';
import * as uuidv4 from 'uuid/v4';

@Injectable()
export class ErrorLogService {
  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: MongoRepository<ErrorLog>,
  ) {}

  async find() {
    return await this.errorLogRepository.find();
  }

  async create(errorLog: ErrorLog) {
    return await this.errorLogRepository.insertOne(errorLog);
  }

  async findOne(query, param?) {
    return await this.errorLogRepository.findOne(query, param);
  }

  async list(skip, take, sort, filter_query?) {
    let sortQuery;

    try {
      sortQuery = JSON.parse(sort);
    } catch (error) {
      sortQuery = { createdOn: 'desc' };
    }

    for (const key of Object.keys(sortQuery)) {
      sortQuery[key] = sortQuery[key].toUpperCase();
      if (!sortQuery[key]) {
        delete sortQuery[key];
      }
    }

    const $and: any[] = [filter_query ? this.getFilterQuery(filter_query) : {}];

    const where: { $and: any } = { $and };
    const results = await this.errorLogRepository.find({
      skip,
      take,
      where,
      order: sortQuery,
    });

    return {
      docs: results || [],
      length: await this.errorLogRepository.count(where),
      offset: skip,
    };
  }

  async deleteOne(query, param?) {
    return await this.errorLogRepository.deleteOne(query, param);
  }

  async updateOne(query, param) {
    return await this.errorLogRepository.updateOne(query, param);
  }

  async updateMany(query, options?) {
    return await this.errorLogRepository.updateMany(query, options);
  }

  getFilterQuery(query) {
    const keys = Object.keys(query);
    keys.forEach(key => {
      if (query[key]) {
        query[key] = new RegExp(query[key], 'i');
      } else {
        delete query[key];
      }
    });
    return query;
  }

  createErrorLog(
    error,
    docType,
    entity,
    req: { token?: { accessToken?: string; fullName?: string } },
  ) {
    let frappeError;
    const errorLog = new ErrorLog();
    errorLog.createdOn = new Date();
    try {
      frappeError = JSON.parse(error.response.data._server_messages);
      frappeError = JSON.parse(frappeError);
      frappeError = (frappeError as { message?: string }).message;
      errorLog.message = frappeError;
    } catch {}
    errorLog.uuid = uuidv4();
    errorLog.docType = docType;
    errorLog.url = error.config.url;
    errorLog.body = error.config.data;
    errorLog.method = error.config.method;
    errorLog.token =
      req.token && req.token.accessToken ? req.token.accessToken : '';
    errorLog.user = req.token && req.token.fullName ? req.token.fullName : '';
    errorLog.entity = entity;
    errorLog.error = error.response ? error.response.data.exc : error;
    this.create(errorLog)
      .then(success => {})
      .catch(err => {});
  }
}