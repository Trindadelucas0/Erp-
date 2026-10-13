import { describe, expect, it } from 'vitest'
import { parsearOfx } from './parser-ofx.js'
import { parsearPlanilhaExtrato } from './parser-planilha-extrato.js'

describe('parser de extrato bancário', () => {
  it('lê movimentações OFX e preserva o FITID', () => {
    const ofx = Buffer.from(`
      <BANKTRANLIST>
        <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001120000<TRNAMT>1250.50<FITID>abc-1<NAME>CLIENTE A<MEMO>TED RECEBIDA</STMTTRN>
        <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002<TRNAMT>-42.00<FITID>abc-2<CHECKNUM>TAR 001<MEMO>TARIFA</STMTTRN>
      </BANKTRANLIST>
    `)
    const resultado = parsearOfx(ofx)
    expect(resultado.invalidas).toBe(0)
    expect(resultado.linhas).toHaveLength(2)
    expect(resultado.linhas[0]).toMatchObject({ valor: 1250.5, identificador: 'abc-1' })
    expect(resultado.linhas[1]).toMatchObject({ valor: -42, documento: 'TAR 001' })
  })

  it('lê CSV fixo com número brasileiro', async () => {
    const csv = Buffer.from('Data;Histórico;Documento;Valor\n01/10/2026;TED;REC 1;1.250,50')
    const resultado = await parsearPlanilhaExtrato(csv, 'csv')
    expect(resultado.linhas[0]).toMatchObject({ valor: 1250.5, historico: 'TED' })
  })

  it('recusa cabeçalho fora do modelo', async () => {
    const csv = Buffer.from('Dia;Descrição;Valor\n01/10/2026;TED;10')
    await expect(parsearPlanilhaExtrato(csv, 'csv')).rejects.toThrow('Cabeçalho inválido')
  })
})
