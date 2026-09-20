import 'reflect-metadata';
import { toTransactionUpdate } from './transaction.dto';

describe('toTransactionUpdate (mapping de patch)', () => {
  it('mantém ausentes os campos não enviados (toggle isPaid não zera cardId)', () => {
    const patch = toTransactionUpdate({ isPaid: true } as never);

    expect(patch).toEqual({ isPaid: true });
  });

  it('preserva cardId explicitamente enviado', () => {
    const patch = toTransactionUpdate({ cardId: 'card-1' } as never);

    expect(patch).toEqual({ cardId: 'card-1' });
  });

  it('permite zerar cardId quando enviado explicitamente null', () => {
    const patch = toTransactionUpdate({ cardId: null } as never);

    expect(patch).toEqual({ cardId: null });
  });

  it('mapeia isPaid e dueDate juntos', () => {
    const patch = toTransactionUpdate({ isPaid: false, dueDate: '2026-10-05' } as never);

    expect(patch).toEqual({ isPaid: false, dueDate: '2026-10-05' });
  });
});