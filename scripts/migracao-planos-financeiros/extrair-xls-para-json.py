"""
Extrai PLANOS FINANCEIROS.xls (Santri) para dados/planos-financeiros.json.
Uso (na raiz do repo):
  python scripts/migracao-planos-financeiros/extrair-xls-para-json.py "C:\\path\\PLANOS FINANCEIROS.xls"
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import xlrd

RAIZ = Path(__file__).resolve().parents[2]
SAIDA_PADRAO = RAIZ / "dados" / "planos-financeiros.json"


def sim_nao(valor: object) -> bool:
    texto = str(valor).strip().lower()
    if not texto:
        return False
    return texto in ("sim", "s", "true", "1", "yes")


def normalizar_codigo(raw: object) -> str:
    if raw is None or raw == "":
        return ""
    if isinstance(raw, float):
        if raw == int(raw):
            return str(int(raw))
        texto = f"{raw:.10f}".rstrip("0").rstrip(".")
        return texto
    texto = str(raw).strip()
    if not texto:
        return ""
    partes = texto.split(".")
    normalizadas: list[str] = []
    for parte in partes:
        if re.fullmatch(r"\d+", parte):
            normalizadas.append(str(int(parte, 10)))
        else:
            try:
                numero = float(parte)
                if numero == int(numero):
                    normalizadas.append(str(int(numero)))
                else:
                    normalizadas.append(parte)
            except ValueError:
                normalizadas.append(parte)
    return ".".join(normalizadas)


def tipo_api(tipo: str, codigo: str) -> str:
    texto = str(tipo).strip().lower()
    if texto.startswith("rece"):
        return "receita"
    if texto.startswith("desp"):
        return "despesa"
    if texto.startswith("result"):
        return "resultado"
    raiz = codigo.split(".")[0]
    if raiz == "1":
        return "receita"
    if raiz == "2":
        return "despesa"
    if raiz == "3":
        return "resultado"
    raise ValueError(f"Tipo desconhecido: {tipo!r} (código {codigo})")


def raiz_tipo(tipo: str) -> str:
    if tipo == "receita":
        return "1"
    if tipo == "despesa":
        return "2"
    return "3"


def validar_plano(codigo: str, nome: str, tipo: str) -> list[str]:
    erros: list[str] = []
    if len(nome) < 2:
        erros.append(f"{codigo}: nome curto demais")
    if len(nome) > 200:
        erros.append(f"{codigo}: nome longo demais")
    profundidade = len(codigo.split("."))
    if profundidade < 2 or profundidade > 3:
        erros.append(f"{codigo}: profundidade inválida ({profundidade})")
    for segmento in codigo.split("."):
        try:
            numero = int(segmento)
        except ValueError:
            erros.append(f"{codigo}: segmento não numérico ({segmento})")
            continue
        if numero < 0 or numero > 99:
            erros.append(f"{codigo}: segmento fora de 0–99 ({segmento})")
    if not codigo.startswith(f"{raiz_tipo(tipo)}."):
        erros.append(f"{codigo}: código incompatível com tipo {tipo}")
    return erros


def extrair(caminho_xls: Path) -> dict:
    livro = xlrd.open_workbook(str(caminho_xls))
    planilha = livro.sheet_by_index(0)

    planos: list[dict] = []
    ignorados_cabecalho: list[str] = []
    vistos: set[str] = set()
    erros: list[str] = []

    for linha in range(5, planilha.nrows):
        codigo = normalizar_codigo(planilha.cell_value(linha, 0))
        nome = str(planilha.cell_value(linha, 1)).strip()
        if not codigo:
            continue
        if codigo in vistos:
            erros.append(f"Código duplicado na planilha: {codigo}")
            continue
        vistos.add(codigo)

        profundidade = len(codigo.split("."))
        if profundidade == 1:
            ignorados_cabecalho.append(codigo)
            continue

        try:
            tipo = tipo_api(str(planilha.cell_value(linha, 2)), codigo)
        except ValueError as exc:
            erros.append(str(exc))
            continue

        erros_plano = validar_plano(codigo, nome, tipo)
        if erros_plano:
            erros.extend(erros_plano)
            continue

        planos.append(
            {
                "codigo": codigo,
                "nome": nome,
                "tipo": tipo,
                "mostrarNaDre": sim_nao(planilha.cell_value(linha, 3)),
                "permiteLancamentoManual": sim_nao(planilha.cell_value(linha, 5)),
                "exigeAnexoLancamento": sim_nao(planilha.cell_value(linha, 6)),
                "permiteUsoConsumo": sim_nao(planilha.cell_value(linha, 7)),
            }
        )

    codigos = {p["codigo"] for p in planos}
    for plano in planos:
        partes = plano["codigo"].split(".")
        if len(partes) == 3:
            pai = ".".join(partes[:2])
            if pai not in codigos:
                erros.append(f"{plano['codigo']}: grupo pai {pai} ausente")

    if erros:
        raise SystemExit("Validação falhou:\n" + "\n".join(erros))

    planos.sort(key=lambda p: [int(x) for x in p["codigo"].split(".")])

    return {
        "fonte": caminho_xls.name,
        "emitidoEm": "2026-09-01",
        "ignoradosCabecalhoCategoria": ignorados_cabecalho,
        "total": len(planos),
        "planos": planos,
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Informe o caminho do .xls", file=sys.stderr)
        sys.exit(1)

    caminho = Path(sys.argv[1])
    if not caminho.exists():
        print(f"Arquivo não encontrado: {caminho}", file=sys.stderr)
        sys.exit(1)

    pacote = extrair(caminho)
    SAIDA_PADRAO.parent.mkdir(parents=True, exist_ok=True)
    SAIDA_PADRAO.write_text(
        json.dumps(pacote, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"OK: {pacote['total']} planos -> {SAIDA_PADRAO}")
    if pacote["ignoradosCabecalhoCategoria"]:
        print("Ignorados (cabeçalho):", ", ".join(pacote["ignoradosCabecalhoCategoria"]))


if __name__ == "__main__":
    main()
