import { router, json, error, requireAuth, db, isAppDatabaseError } from '@appdeploy/sdk';

type RecordKind =
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'profile';
const allowed: RecordKind[] = [
  'transactions',
  'categories',
  'budgets',
  'goals',
  'profile',
];
function tableFor(userId: string, kind: RecordKind) {
  // AppDeploy user IDs are UUIDs. Reject unexpected identities rather than
  // normalizing distinct IDs into a potentially colliding table name.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Invalid authenticated user identity.');
  }
  return 'eb_' + userId.toLowerCase() + '_' + kind;
}
function requestError(cause: unknown, fallback: string) {
  if (isAppDatabaseError(cause)) return error(cause.message, cause.statusCode);
  return error(cause instanceof Error ? cause.message : fallback, 400);
}
function validKind(value: string): value is RecordKind {
  return allowed.includes(value as RecordKind);
}
function validMonth(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && year <= 9999;
}
function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validAmount(value: unknown) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 100000000000
  );
}
function cleanRecord(kind: RecordKind, body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new Error('Invalid request body');
  if (kind === 'transactions') {
    if (
      !['expense', 'income'].includes(body.kind) ||
      !validAmount(body.amount) ||
      typeof body.category !== 'string' ||
      !body.category.trim() ||
      !validDate(body.date) ||
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      body.title.length > 80 ||
      typeof body.description !== 'string' ||
      !body.description.trim() ||
      body.description.length > 120
    ) {
      throw new Error(
        'Enter a valid type, positive amount, category, date and description.'
      );
    }
    return {
      kind: body.kind,
      amount: body.amount,
      category: body.category.trim().slice(0, 60),
      date: body.date,
      title: body.title.trim(),
      description: body.description.trim(),
    };
  }
  if (kind === 'categories') {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 40 ||
      !['expense', 'income'].includes(body.type)
    )
      throw new Error('Enter a valid category name and type.');
    return {
      name: body.name.trim(),
      type: body.type,
      color:
        typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#8b5cf6',
      icon: typeof body.icon === 'string' ? body.icon.slice(0, 8) : '✨',
    };
  }
  if (kind === 'budgets') {
    if (
      !validMonth(body.month) ||
      !validAmount(body.amount) ||
      (body.alertedThresholds !== undefined && (!Array.isArray(body.alertedThresholds) || body.alertedThresholds.some((value: unknown) => ![75, 90, 100].includes(value as number))))
    )
      throw new Error('Enter a valid month, positive budget amount and valid alert state.');
    return {
      month: body.month,
      amount: body.amount,
      alertedThresholds: [...new Set((body.alertedThresholds || []).map(Number))].sort((a, b) => a - b),
    };
  }
  if (kind === 'goals') {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 80 ||
      !validAmount(body.target) ||
      typeof body.saved !== 'number' ||
      !Number.isFinite(body.saved) ||
      body.saved < 0 ||
      body.saved > 100000000000
    )
      throw new Error('Enter a valid goal name, target and saved amount.');
    return {
      name: body.name.trim(),
      target: body.target,
      saved: body.saved,
      deadline:
        body.deadline === '' || body.deadline === undefined ? '' : validDate(body.deadline) ? body.deadline : (() => { throw new Error('Enter a valid goal deadline.'); })(),
    };
  }
  if (
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    body.name.length > 80 ||
    !['PKR', 'USD', 'GBP', 'EUR', 'AED'].includes(body.currency)
  )
    throw new Error('Enter a valid profile name and currency.');
  return {
    name: body.name.trim(),
    email: typeof body.email === 'string' ? body.email.slice(0, 200) : '',
    institution:
      typeof body.institution === 'string'
        ? body.institution.slice(0, 120)
        : '',
    currency: body.currency,
  };
}
export const handler = router({
  'GET /api/health': [async () => json({ ok: true })],
  'GET /api/bootstrap': [
    requireAuth(),
    async ctx => {
      const userId = ctx.user!.userId;
      const kinds: RecordKind[] = [
        'transactions',
        'categories',
        'budgets',
        'goals',
        'profile',
      ];
      const results = await Promise.all([
        db.list(tableFor(userId, 'transactions'), { limit: 500 }),
        db.list(tableFor(userId, 'categories'), { limit: 500 }),
        db.list(tableFor(userId, 'budgets'), { limit: 500 }),
        db.list(tableFor(userId, 'goals'), { limit: 500 }),
        db.get(tableFor(userId, 'profile'), ['profile']),
      ]);
      const storedProfile = results[4][0] || null;
      const profile = storedProfile ? { ...storedProfile, email: ctx.user!.email || '' } : null;
      const incomplete = [
        results[0].nextToken ? 'transactions' : null,
        results[1].nextToken ? 'categories' : null,
        results[2].nextToken ? 'budgets' : null,
        results[3].nextToken ? 'goals' : null,
      ].filter((kind): kind is string => kind !== null);
      return json({
        incomplete,
        transactions: results[0].items,
        categories: results[1].items,
        budgets: results[2].items,
        goals: results[3].items,
        profile,
      });
    },
  ],
  'POST /api/budgets/:id/alerts': [
    requireAuth(),
    async ctx => {
      const userId = ctx.user!.userId;
      const requestedId = ctx.params.id;
      try {
        // Resolve the budget in this authenticated student's partition by month.
        const requestedMonth = (ctx.body as any)?.month;
        if (requestedMonth !== undefined && !validMonth(requestedMonth)) return error('Invalid budget month.', 400);
        const budgetPage = await db.list<any>(tableFor(userId, 'budgets'), { limit: 500 });
        if (budgetPage.nextToken) return error('Budget history is incomplete. Alert evaluation is blocked until the complete budget list is available.', 409);
        const budget = budgetPage.items.find((item: any) => requestedMonth ? item.month === requestedMonth : item.id === requestedId);
        if (!budget) return json({ newlyAlerted: [], skipped: 'budget_not_found' });
        if (!validMonth(budget.month) || !validAmount(budget.amount)) return error('The saved budget is invalid. Please edit it before evaluating alerts.', 409);
        const budgetId = budget.id;
        const txs = await db.list<any>(tableFor(userId, 'transactions'), { limit: 500 });
        if (txs.nextToken) return error('This account has more than 500 transactions. Alert calculation requires the full transaction history; contact support for a complete review.', 409);
        const spent = txs.items.reduce((sum, tx) => tx.kind === 'expense' && typeof tx.date === 'string' && tx.date.startsWith(budget.month) && typeof tx.amount === 'number' ? sum + tx.amount : sum, 0);
        const reached = [75, 90, 100].filter(value => spent / budget.amount * 100 >= value);

        // Concurrent dashboard renders can evaluate the same budget at once.
        // Compare a scalar version instead of an array, then re-read and retry
        // only known conditional conflicts. This makes duplicate calls idempotent.
        for (let attempt = 0; attempt < 4; attempt++) {
          const [fresh] = await db.get<any>(tableFor(userId, 'budgets'), [budgetId], { consistent: true });
          if (!fresh) return json({ newlyAlerted: [], skipped: 'budget_not_found' });
          const previous: number[] = Array.isArray(fresh.alertedThresholds) ? fresh.alertedThresholds : [];
          const newlyReached = reached.filter(value => !previous.includes(value));
          if (!newlyReached.length) return json({ newlyAlerted: [] });
          const next = [...new Set([...previous, ...newlyReached])].sort((a, b) => a - b);
          const version = Number.isSafeInteger(fresh.alertVersion) && fresh.alertVersion >= 0 ? fresh.alertVersion : 0;
          try {
            const [updated] = await db.tx.update(tableFor(userId, 'budgets'), [{
              id: budgetId,
              record: { alertedThresholds: next, alertVersion: version + 1 },
              if: { alertVersion: fresh.alertVersion },
            }], { patch: true });
            if (updated) return json({ newlyAlerted: newlyReached });
          } catch (writeError: unknown) {
            if (isAppDatabaseError(writeError) && !['AppDatabaseConflict', 'AppDatabaseConditionFailed'].includes(writeError.code)) throw writeError;
            if (!isAppDatabaseError(writeError)) throw writeError;
            // A known concurrent write is safe to retry after a fresh read.
          }
        }

        // Under sustained contention, do not turn a harmless alert race into a
        // user-facing API error. A later evaluation will reconcile the state.
        const [latest] = await db.get<any>(tableFor(userId, 'budgets'), [budgetId], { consistent: true });
        const saved: number[] = Array.isArray(latest?.alertedThresholds) ? latest.alertedThresholds : [];
        if (reached.every(value => saved.includes(value))) return json({ newlyAlerted: [] });
        return json({ newlyAlerted: [], retry: true });
      } catch (e: unknown) {
        return isAppDatabaseError(e) ? error(e.message, e.statusCode) : error(e instanceof Error ? e.message : 'Could not evaluate budget alerts.', 500);
      }
    },
  ],
  'GET /api/records/:kind': [
    requireAuth(),
    async ctx => {
      const kind = ctx.params.kind;
      if (!validKind(kind)) return error('Unknown record type', 404);
      const result = await db.list(tableFor(ctx.user!.userId, kind), {
        limit: 500,
      });
      return json({ items: result.items });
    },
  ],
  'POST /api/records/:kind': [
    requireAuth(),
    async ctx => {
      const kind = ctx.params.kind;
      if (!validKind(kind)) return error('Unknown record type', 404);
      try {
        const data = cleanRecord(kind, ctx.body);
        if (kind === 'profile') data.email = ctx.user!.email || '';
        if (kind === 'transactions') {
          const builtIn = [
            ...['Food','Transportation','Education','Shopping','Entertainment','Healthcare','Accommodation','Utilities','Other'].map(name => ({ name, type: 'expense' })),
            ...['Allowance / Salary','Freelance'].map(name => ({ name, type: 'income' })),
          ];
          const custom = await db.list<any>(tableFor(ctx.user!.userId, 'categories'), { limit: 500 });
          if (custom.nextToken) return error('Category list is incomplete. Please contact support before adding transactions.', 409);
          if (![...builtIn, ...custom.items].some(category => category.name === data.category && category.type === data.kind)) return error('Choose a category configured for this transaction type.', 400);
        }
        if (kind === 'categories') {
          const existing = await db.list(tableFor(ctx.user!.userId, 'categories'), { limit: 500 });
          if (existing.nextToken) return error('Category list is incomplete; duplicate checking cannot be safely completed.', 409);
          if (existing.items.some((item: any) => item.type === data.type && item.name.toLowerCase() === data.name.toLowerCase())) return error('A category with this name already exists.', 409);
        }
        if (kind === 'budgets') {
          const existing = await db.list(tableFor(ctx.user!.userId, 'budgets'), { limit: 500 });
          if (existing.nextToken) return error('Budget list is incomplete; monthly uniqueness cannot be safely checked.', 409);
          if (existing.items.some((item: any) => item.month === data.month)) return error('A budget already exists for this month. Edit the existing budget instead.', 409);
        }
        const id =
          kind === 'profile'
            ? 'profile'
            : typeof (ctx.body as any)?.id === 'string' &&
                /^[A-Za-z0-9_-]{1,80}$/.test((ctx.body as any).id)
              ? (ctx.body as any).id
              : crypto.randomUUID();
        if (kind === 'profile') {
          const [existing] = await db.get(tableFor(ctx.user!.userId, kind), [
            'profile',
          ]);
          if (existing)
            return error('Profile already exists; update it instead.', 409);
        }
                // db.add generates a physical key independently of record.id. Use the
        // chosen-ID transaction API so the ID returned to the client is the
        // actual database key later used by update/delete/alert endpoints.
        const [created] = await db.tx.add(tableFor(ctx.user!.userId, kind), [
          { id, ...data },
        ]);
        if (!created)
          return error('A record with this ID already exists or could not be created. Please retry.', 409);
        return json({ id: created, ...data }, 201);
      } catch (e: unknown) {
        return requestError(e, 'Could not create this record. Please retry.');
      }
    },
  ],
  'PUT /api/records/:kind/:id': [
    requireAuth(),
    async ctx => {
      const kind = ctx.params.kind;
      if (!validKind(kind)) return error('Unknown record type', 404);
      const id = ctx.params.id;
      if (kind === 'profile' && id !== 'profile')
        return error('Invalid profile id', 400);
      try {
        const data = cleanRecord(kind, ctx.body);
        if (kind === 'profile') data.email = ctx.user!.email || '';
        if (kind === 'transactions') {
          const builtIn = [
            ...['Food','Transportation','Education','Shopping','Entertainment','Healthcare','Accommodation','Utilities','Other'].map(name => ({ name, type: 'expense' })),
            ...['Allowance / Salary','Freelance'].map(name => ({ name, type: 'income' })),
          ];
          const custom = await db.list<any>(tableFor(ctx.user!.userId, 'categories'), { limit: 500 });
          if (custom.nextToken) return error('Category list is incomplete. Please contact support before adding transactions.', 409);
          if (![...builtIn, ...custom.items].some(category => category.name === data.category && category.type === data.kind)) return error('Choose a category configured for this transaction type.', 400);
        }
        if (kind === 'budgets') {
          const existing = await db.list(tableFor(ctx.user!.userId, 'budgets'), { limit: 500 });
          if (existing.items.some((item: any) => item.id !== id && item.month === data.month)) return error('A budget already exists for this month.', 409);
          const [storedBudget] = await db.get<any>(tableFor(ctx.user!.userId, 'budgets'), [id], { consistent: true });
          if (!storedBudget) return error('Budget not found.', 404);
          data.alertedThresholds = Array.isArray(storedBudget.alertedThresholds) ? storedBudget.alertedThresholds : [];
        }
        if (kind === 'categories') {
          if (id.startsWith('cat-')) return error('Default categories cannot be edited.', 403);
          const [current] = await db.get<any>(tableFor(ctx.user!.userId, 'categories'), [id]);
          if (!current) return error('Category not found.', 404);
          const [categoryRecords, transactionRecords] = await Promise.all([
            db.list(tableFor(ctx.user!.userId, 'categories'), { limit: 500 }),
            db.list(tableFor(ctx.user!.userId, 'transactions'), { limit: 500 }),
          ]);
          if (categoryRecords.nextToken || transactionRecords.nextToken) return error('Category or transaction history is incomplete; this edit is blocked to protect existing records.', 409);
          if (categoryRecords.items.some((item: any) => item.id !== id && item.type === data.type && item.name.toLowerCase() === data.name.toLowerCase())) return error('A category with this name already exists.', 409);
          const inUse = transactionRecords.items.some((item: any) => item.category === current.name);
          if (inUse && (data.name !== current.name || data.type !== current.type)) return error('This category is used by transactions. Its name and type cannot be changed.', 409);
        }
        const [updated] = await db.tx.update(tableFor(ctx.user!.userId, kind), [
          { id, record: data },
        ]);
        if (!updated)
          return error('Record not found or could not be updated.', 404);
        return json({ id, ...data });
      } catch (e: unknown) {
        return requestError(e, 'Could not create this record. Please retry.');
      }
    },
  ],
  'DELETE /api/records/:kind/:id': [
    requireAuth(),
    async ctx => {
      const kind = ctx.params.kind;
      if (!validKind(kind)) return error('Unknown record type', 404);
      if (kind === 'profile') return error('Profile cannot be deleted.', 400);
      if (kind === 'categories') {
        if (ctx.params.id.startsWith('cat-')) return error('Default categories cannot be deleted.', 403);
        const [category] = await db.get<any>(tableFor(ctx.user!.userId, 'categories'), [ctx.params.id]);
        if (!category) return error('Category not found.', 404);
        const transactions = await db.list(tableFor(ctx.user!.userId, 'transactions'), { limit: 500 });
        if (transactions.nextToken) return error('Transaction history is incomplete; category deletion is blocked to protect existing records.', 409);
        if (transactions.items.some((item: any) => item.category === category.name)) return error('This category is used by existing transactions. Move those transactions before deleting it.', 409);
      }
      const [deleted] = await db.delete(tableFor(ctx.user!.userId, kind), [
        ctx.params.id,
      ]);
      return deleted
        ? json({ deleted: true })
        : error('Record not found.', 404);
    },
  ],
});
