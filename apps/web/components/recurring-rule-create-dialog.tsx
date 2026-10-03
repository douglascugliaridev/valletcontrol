'use client';

import type { Category, Month, TransactionType } from '@walletcontrol/shared';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TO_TYPE,
  Category as CategoryEnum,
  MAX_MONTHS_AHEAD,
  MONTH_NAMES_LONG,
  TransactionType as TransactionTypeEnum,
  TRANSACTION_TYPE_LABELS,
} from '@walletcontrol/shared';
import { ApiError } from '@/lib/api';
import { parseReaisToCents } from '@/lib/format';
import { useMaterializeRecurringBill } from '@/lib/hooks';
import { Button, Input, Label, Modal, Select, Spinner } from '@/components/ui';
import { useEffect, useState } from 'react';

interface RecurringRuleCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Quantos lançamentos foram materializados, para a tela confirmar. */
  onCreated: (created: number) => void;
}

/**
 * Categorias coerentes com o tipo escolhido.
 *
 * O domínio recusa a combinação errada com `CATEGORY_TYPE_MISMATCH`
 * (`packages/shared/src/domain/rules.ts`), então o formulário não deve oferecer a
 * opção: `receita` + "Contas Fixas" é receita? não — é um estado que só existe
 * porque o select deixou o usuário montar.
 */
function categoriesFor(type: TransactionType): Category[] {
  return CATEGORIES.filter((c) => CATEGORY_TO_TYPE[c] === type);
}

/**
 * Só receita e despesa. "Devedor" é uma relação pontual — alguém te deve um valor —, e
 * o domínio exige método de pagamento nesse tipo (`PAYMENT_METHOD_REQUIRED`). A
 * materialização monta `paymentMethod: null` fixo, então oferecer o tipo aqui era uma
 * opção que só podia terminar em 422.
 */
const RECURRENCE_TYPES: readonly TransactionType[] = [
  TransactionTypeEnum.INCOME,
  TransactionTypeEnum.EXPENSE,
];

/**
 * Criação de recorrência em Configurações.
 *
 * Existe porque o formulário do dashboard só oferece "quantidade de meses" para
 * **despesa** sem cartão na categoria "contas fixas" — regra que existe para não
 * sequestrar uma compra no cartão. Efeito colateral: receita recorrente (um salário,
 * por exemplo) ficava sem caminho nenhum. Aqui os campos são explícitos, então
 * qualquer tipo serve.
 *
 * O padrão é `receita` justamente porque a despesa já tem caminho próprio: quem chega
 * nesta tela vindo do dashboard é o caso que ficou sem porta de entrada.
 */
export function RecurringRuleCreateDialog({
  open,
  onClose,
  onCreated,
}: RecurringRuleCreateDialogProps) {
  const materialize = useMaterializeRecurringBill();

  const today = new Date();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionTypeEnum.INCOME);
  const [category, setCategory] = useState<Category>(CategoryEnum.INCOME);
  const [month, setMonth] = useState<Month>((today.getMonth() + 1) as Month);
  const [year, setYear] = useState(today.getFullYear());
  const [months, setMonths] = useState('12');
  const [isPaid, setIsPaid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reabrir o diálogo começa limpo: um erro anterior não deve reaparecer junto com
  // o formulário, e os campos não podem vir recarregados da tentativa que falhou.
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setDescription('');
    setAmount('');
    setType(TransactionTypeEnum.INCOME);
    setCategory(CategoryEnum.INCOME);
    setMonth((now.getMonth() + 1) as Month);
    setYear(now.getFullYear());
    setMonths('12');
    setIsPaid(false);
    setFormError(null);
  }, [open]);

  const changeType = (next: TransactionType) => {
    setType(next);
    const [first] = categoriesFor(next);
    if (first) setCategory(first);
  };

  const submit = async () => {
    const amountCents = parseReaisToCents(amount);
    const total = Number(months);

    if (!description.trim()) {
      setFormError('Informe a descrição.');
      return;
    }
    if (amountCents === null) {
      setFormError('Informe um valor válido.');
      return;
    }
    if (!Number.isInteger(total) || total < 1) {
      setFormError('A quantidade de meses deve ser um número inteiro maior que zero.');
      return;
    }
    if (total > MAX_MONTHS_AHEAD) {
      setFormError(`Máximo de ${MAX_MONTHS_AHEAD} meses.`);
      return;
    }

    try {
      const result = await materialize.mutateAsync({
        description: description.trim(),
        amountCents,
        type,
        category,
        month,
        year,
        months: total,
        isPaid,
        dueDate: null,
      });
      onCreated(result.transactions.length);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível criar a recorrência.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova recorrência">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Cria a recorrência e já materializa os lançamentos de cada mês. São transações de verdade:
          aparecem no relatório e podem ser pagas uma a uma.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-description">Descrição</Label>
          <Input
            id="rule-description"
            value={description}
            placeholder="Salário"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-amount">Valor</Label>
            <Input
              id="rule-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-type">Tipo</Label>
            <Select
              id="rule-type"
              value={type}
              onChange={(e) => changeType(e.target.value as TransactionType)}
            >
              {RECURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TRANSACTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-category">Categoria</Label>
          <Select
            id="rule-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {categoriesFor(type).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-month">Mês</Label>
            <Select
              id="rule-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value) as Month)}
            >
              {MONTH_NAMES_LONG.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-year">Ano</Label>
            <Select id="rule-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-months">Meses</Label>
            <Input
              id="rule-months"
              type="number"
              min={1}
              max={MAX_MONTHS_AHEAD}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />O
          mês de referência já está {type === TransactionTypeEnum.INCOME ? 'recebido' : 'pago'}
        </label>

        <p className="text-xs text-muted-foreground">
          Os meses seguintes nascem pendentes. “Meses” conta o mês de referência:{' '}
          {Number.isInteger(Number(months)) && Number(months) > 0
            ? `${months} lançamentos`
            : 'N lançamentos'}{' '}
          começando em {MONTH_NAMES_LONG[month - 1]?.slice(0, 3)}/{year}.
        </p>

        {formError && (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={materialize.isPending} onClick={() => void submit()}>
            {materialize.isPending ? <Spinner className="size-4" /> : null}
            Criar recorrência
          </Button>
        </div>
      </div>
    </Modal>
  );
}
