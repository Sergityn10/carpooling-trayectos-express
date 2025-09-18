import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { ConnectionError } from './errors/ConnectionError.js';
dotenv.config();
const databaseConnection = mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'carpooling'
})

const getConnection = async() => {
    // let connection
    // try {
    //    connection = await databaseConnection.connect();
    // } catch (error) {
    //     throw new ConnectionError('Error de conexión a la base de datos', error);
    // }
    return databaseConnection
}

export const database=
 { getConnection };