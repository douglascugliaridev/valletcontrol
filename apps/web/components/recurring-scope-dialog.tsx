'use client';

import { Modal } from '@/components/ui';
import { MONTH_NAMES_LONG } from '@walletcontrol/shared';
import type { Month } from '@walletcontrol/shared';

export type ScopeChoice = 'month' | 'forward';

interface RecurringScopeDialogProps {
  open: boolean;
  /** `editar` ou `excluir` — muda só o verbo da pergunta. */
  action: 'editar' | 'excluir';
  /** Descrição da conta, para o usuário saber sobre qual está decidindo. */
  description: string;
  /** Mês da linha being edited/deleted: a âncora do escopo. */
  referenceMonth: Month;
  referenceYear: number;
  /** Último mês do grupo, quando conhecido — deixa "à frente" concreto. */
  lastMonth?: { month: Month; year: number } | null;
  onCancel: () => void;
  onChoose: (scope: ScopeChoice) => void;
}

function label(month: Month, year: number): string {
  return `${MONTH_NAMES_LONG[month - 1] ?? '?'}/${year}`;
}

/**
 * Diálogo de escopo das contas fixas: "só este mês" ou "também os meses à frente".
 *
 * Mostra os meses explicitamente porque "à frente" é ambíguo sem referência — o
 * usuário precisa ver que está alterando de mar/2027 em diante.
 *
 * O escopo **nunca alcança um lançamento já pago**: a API filtra `isPaid: false` tanto
 * na edição em bloco quanto na exclusão. Por isso a última linha avisa antes, senão o
 * usuário contaria os meses e acharia que some falta.
 */
export function RecurringScopeDialog({
  open,
  action,
  description,
  referenceMonth,
  referenceYear,
  lastMonth,
  onCancel,
  onChoose,
}: RecurringScopeDialogProps) {
  const from = label(referenceMonth, referenceYear);
  const to = lastMonth ? label(lastMonth.month, lastMonth.year) : null;
  const isDelete = action === 'excluir';

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={isDelete ? 'Excluir conta fixa' : 'Aplicar em todos os meses'}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            {isDelete ? (
              <>
                Excluir <strong>{description}</strong> da {from} em diante?
              </>
            ) : (
              <>
                Aplicar a alteração em <strong>{description}</strong> na {from} e nos meses
                seguintes?
              </>
            )}
          </p>
          {to && (
            <p className="text-xs text-muted-foreground">
              O grupo vai de {from} até {to}. Os meses anteriores à {from} permanecem como estão.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoose('month')}
            className="rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <span className="block text-sm font-medium">Somente {from}</span>
            <span className="block text-xs text-muted-foreground">
              Não muda nem exclui nenhum outro mês.
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChoose('forward')}
            className="rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <span className="block text-sm font-medium">
              {isDelete ? `Excluir da ${from} em diante` : `Aplicar da ${from} em diante`}
            </span>
            <span className="block text-xs text-muted-foreground">
              {to ? `Afeta ${from} até ${to}.` : `Afeta ${from} e os meses seguintes do grupo.`}
            </span>
            <span className="block text-xs text-muted-foreground">
              {isDelete
                ? 'Meses já pagos ficam intactos.'
                : 'Meses já pagos ficam intactos — o valor de um pagamento não muda em bloco.'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:underline"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
