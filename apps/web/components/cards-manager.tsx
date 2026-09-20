'use client';

import type { Card as CardEntity, CardBrand } from '@valletcontrol/shared';
import { CARD_BRAND_LABELS, CARD_BRANDS, formatCardLabel } from '@valletcontrol/shared';
import {
  useCards,
  useCreateCard,
  useDeleteCard,
  useUpdateCard,
  useUploadCardLogo,
} from '@/lib/hooks';
import { ApiError, resolveAssetUrl } from '@/lib/api';
import { CardLogo } from '@/components/card-logo';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
} from '@/components/ui';
import { CreditCard, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

const NEW_CARD: CardDraft = {
  name: '',
  brand: 'nubank',
  last4: '',
  color: '',
  isDefault: false,
};

interface CardDraft {
  name: string;
  brand: CardBrand;
  last4: string;
  color: string;
  isDefault: boolean;
}

function toDraft(card: CardEntity): CardDraft {
  return {
    name: card.name,
    brand: card.brand,
    last4: card.last4 ?? '',
    color: card.color ?? '',
    isDefault: card.isDefault ?? false,
  };
}

export function CardsManager() {
  const { data: cards, isLoading } = useCards();
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const uploadCardLogo = useUploadCardLogo();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardEntity | null>(null);
  const [draft, setDraft] = useState<CardDraft>(NEW_CARD);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CardEntity | null>(null);

  const openCreate = () => {
    setFormError(null);
    setEditing(null);
    setDraft(NEW_CARD);
    setLogoFile(null);
    setRemoveLogo(false);
    setFormOpen(true);
  };

  const openEdit = (card: CardEntity) => {
    setFormError(null);
    setEditing(card);
    setDraft(toDraft(card));
    setLogoFile(null);
    setRemoveLogo(false);
    setFormOpen(true);
  };

  const set = (patch: Partial<CardDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const previewSrc = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    return editing?.logoUrl ? resolveAssetUrl(editing.logoUrl) : undefined;
  }, [editing, logoFile]);

  const submit = async () => {
    setFormError(null);
    if (!draft.name.trim()) {
      setFormError('Informe o nome do cartão.');
      return;
    }
    const input = {
      name: draft.name.trim(),
      brand: draft.brand,
      last4: draft.last4.trim() || null,
      color: draft.color.trim() || null,
      isDefault: draft.isDefault,
    };
    try {
      if (editing) {
        const patch = removeLogo ? { ...input, logoUrl: null } : input;
        await updateCard.mutateAsync({ id: editing.id, patch });
        if (logoFile) {
          await uploadCardLogo.mutateAsync({ id: editing.id, file: logoFile });
        }
      } else {
        const created = await createCard.mutateAsync(input);
        if (logoFile) {
          await uploadCardLogo.mutateAsync({ id: created.id, file: logoFile });
        }
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o cartão.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteCard.mutateAsync(pendingDelete.id);
    } finally {
      setPendingDelete(null);
    }
  };

  const saving = createCard.isPending || updateCard.isPending || uploadCardLogo.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <CardTitle>Meus cartões</CardTitle>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Novo cartão
        </Button>
      </CardHeader>

      <div className="divide-y divide-border border-t border-border">
        {isLoading && !cards ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Spinner className="mx-auto size-5" />
          </div>
        ) : (cards ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum cartão cadastrado. Crie um para usar no lançamento de devedores.
          </p>
        ) : (
          (cards ?? []).map((card) => (
            <div key={card.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
                style={
                  card.logoUrl
                    ? undefined
                    : card.color
                      ? { backgroundColor: card.color }
                      : undefined
                }
              >
                {card.logoUrl ? (
                  <CardLogo logoUrl={card.logoUrl} alt={card.name} />
                ) : (
                  <CreditCard className="size-4 text-muted-foreground" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{formatCardLabel(card)}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {CARD_BRAND_LABELS[card.brand]}
                  {card.isDefault && <Badge tone="accent">Padrão</Badge>}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(card)}
                  aria-label="Editar cartão"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setPendingDelete(card)}
                  aria-label="Excluir cartão"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar cartão' : 'Novo cartão'}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-name">Nome</Label>
            <Input
              id="card-name"
              placeholder="Ex.: Meu Nubank"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-brand">Bandeira</Label>
              <Select
                id="card-brand"
                value={draft.brand}
                onChange={(e) => set({ brand: e.target.value as CardBrand })}
              >
                {CARD_BRANDS.map((brand) => (
                  <option key={brand} value={brand}>
                    {CARD_BRAND_LABELS[brand]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-last4">Últimos 4 dígitos</Label>
              <Input
                id="card-last4"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                value={draft.last4}
                onChange={(e) => set({ last4: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-color">Cor de destaque</Label>
            <Input
              id="card-color"
              type="color"
              value={draft.color || '#512DA8'}
              onChange={(e) => set({ color: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-logo">Logo do cartão</Label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="card-logo"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Upload className="size-4 text-muted-foreground" />
                <span className="max-w-40 truncate">
                  {logoFile ? logoFile.name : 'Escolher imagem'}
                </span>
                <input
                  id="card-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogoFile(file);
                    if (file) setRemoveLogo(false);
                  }}
                />
              </label>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
                {previewSrc ? (
                  <CardLogo logoUrl={previewSrc} alt={draft.name ?? 'Cartão'} />
                ) : (
                  <CreditCard className="size-4 text-muted-foreground" />
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, até 2 MB.</p>
            {(logoFile ?? editing?.logoUrl) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setLogoFile(null);
                  setRemoveLogo(Boolean(editing?.logoUrl));
                }}
              >
                Remover logo
              </Button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => set({ isDefault: e.target.checked })}
              className={cn('size-4 accent-[var(--color-primary)]')}
            />
            Cartão padrão (selecionado por padrão no form de transação)
          </label>

          {formError && (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !draft.name.trim()}>
              {saving ? <Spinner className="size-4" /> : null}
              {editing ? 'Salvar alterações' : 'Criar cartão'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Excluir cartão"
      >
        <p className="text-sm text-muted-foreground">
          Deseja excluir o cartão “{pendingDelete ? formatCardLabel(pendingDelete) : ''}”? As
          transações vinculadas ficam sem cartão.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            {deleteCard.isPending ? <Spinner className="size-4" /> : 'Excluir'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
