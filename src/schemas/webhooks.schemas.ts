import { z } from "zod";
import { transformarSnakeToCamel } from "../utils/object.utils.js";

export const dialerStatusBody = z.object({
  negociacaoId: z.string().uuid(),
  dialerCallId: z.string().optional(),
  resultado: z.enum([
    "ATENDEU",
    "NAO_ATENDEU",
    "OCUPADO",
    "CAIU",
    "NUMERO_INVALIDO",
    "CAIXA_POSTAL",
  ]),
  duracaoSegundos: z.number().optional(),
}).transform(transformarSnakeToCamel);

export const decisorBody = z.preprocess(
  transformarSnakeToCamel,
  z.object({
    negociacaoId: z.preprocess(
      (value) => value === null || value === "null" || value === "" ? undefined : value,
      z.string().uuid().optional(),
    ),
    nomeEmpresa: z.string().min(1).optional(),
    telefoneEmpresa: z.string().optional(),
    nomeContato: z.string().min(1).optional(),
    ehdecisor: z.boolean().optional(),
    nomeDecisor: z.string().min(1).optional(),
    cargoDecisor: z.string().optional(),
    cargo: z.string().optional(),
    emailDecisor: z.preprocess(
      (value) => value === "null" || value === null ? "" : value,
      z.string().email().optional().or(z.literal("")),
    ),
    email: z.preprocess(
      (value) => value === "null" || value === null ? "" : value,
      z.string().email().optional().or(z.literal("")),
    ),
    telefoneDecisor: z.string().optional(),
    telefone: z.string().optional(),
    naoLigarNovamente: z.boolean().optional(),
    consentimentoLigacao: z.boolean().optional(),
    cenarioAtendimento: z.string().optional(),
    dorIdentificada: z.string().optional(),
    objecaoPrincipal: z.string().optional(),
    interesse: z.boolean(),
    nivelInteresse: z.preprocess(
      (value) => typeof value === "string" ? value.toUpperCase() : value,
      z.enum(["ALTO", "MEDIO", "BAIXO", "SEM_INTERESSE"]),
    ),
    aceitouReuniao: z.boolean(),
    horarioReuniaoSugerido: z.string().optional(),
    dataHoraContato: z.string().optional(),
    solicitouRetorno: z.boolean().default(false),
    resultadoLigacao: z.string(),
    observacao: z.string().min(1),
    decisorPediuNaoLigarMais: z.boolean().default(false),
  }),
);

export const gatekeeperBody = z.preprocess(
  transformarSnakeToCamel,
  z.object({
    negociacaoId: z.string().uuid(),
    telefoneEmpresa: z.string().optional(),
    nomeDecisor: z.string().min(1).optional(),
    cargoDecisor: z.string().optional(),
    emailDecisor: z.preprocess(
      (value) => value === "null" || value === null ? "" : value,
      z.string().email().optional().or(z.literal("")),
    ),
    telefoneDecisor: z.string().optional(),
    naoLigarNovamente: z.boolean().optional(),
    consentimentoLigacao: z.boolean().optional(),
    dataHoraContato: z.string().optional(),
    observacao: z.string().min(1),
    interesse: z.boolean(),
    transferida: z.boolean(),
    solicitouRetorno: z.boolean().default(false),
  }),
);

export type DialerStatusInput = z.infer<typeof dialerStatusBody>;
export type GatekeeperInput = z.infer<typeof gatekeeperBody>;
export type DecisorInput = z.infer<typeof decisorBody>;
