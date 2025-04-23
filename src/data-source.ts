import { DataSourceOptions } from 'typeorm';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

export const AppDataSource: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:
    process.env.DB_SSL === 'on'
      ? {
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA_CERT
            ? fs.readFileSync(process.env.DB_SSL_CA_CERT).toString()
            : undefined,
          key: process.env.DB_SSL_KEY
            ? fs.readFileSync(process.env.DB_SSL_KEY).toString()
            : undefined,
          cert: process.env.DB_SSL_CERT
            ? fs.readFileSync(process.env.DB_SSL_CERT).toString()
            : undefined,
        }
      : false,
};

export const CRMDataSource: DataSourceOptions = {
  type: 'postgres',
  host: process.env.CRM_DB_HOST,
  port: +process.env.CRM_DB_PORT,
  username: process.env.CRM_DB_USERNAME,
  password: process.env.CRM_DB_PASSWORD,
  database: process.env.CRM_DB_NAME,
  ssl:
    process.env.CRM_DB_SSL === 'on'
      ? {
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA_CERT
            ? fs.readFileSync(process.env.DB_SSL_CA_CERT).toString()
            : undefined,
          key: process.env.DB_SSL_KEY
            ? fs.readFileSync(process.env.DB_SSL_KEY).toString()
            : undefined,
          cert: process.env.DB_SSL_CERT
            ? fs.readFileSync(process.env.DB_SSL_CERT).toString()
            : undefined,
        }
      : false,
};
