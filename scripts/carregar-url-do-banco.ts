/**
 * Carrega o .env e monta DATABASE_URL a partir das variáveis DB_*.
 * Usado pelos comandos do Prisma (migrate, studio, generate).
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { definirUrlDoBancoNoAmbiente } from '../src/compartilhado/banco-dados/montar-url-do-banco.js'

config({ path: resolve(process.cwd(), '.env') })
definirUrlDoBancoNoAmbiente()
