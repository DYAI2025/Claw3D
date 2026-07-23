import {
  defaultTaskBoardPreference,
  type TaskBoardCard,
  type TaskBoardPreference,
  type TaskBoardStatus,
} from "@/features/office/tasks/types";

type TaskBoardAction =
  | { type: "hydrate"; preference: TaskBoardPreference }
  | { type: "upsert"; card: TaskBoardCard }
  | { type: "upsertMany"; cards: TaskBoardCard[] }
  | { type: "update"; cardId: string; patch: Partial<TaskBoardCard> }
  | { type: "move"; cardId: string; status: TaskBoardStatus }
  | { type: "remove"; cardId: string }
  | { type: "select"; cardId: string | null };

const compareCards = (left: TaskBoardCard, right: TaskBoardCard) => {
  const leftArchived = left.isArchived ? 1 : 0;
  const rightArchived = right.isArchived ? 1 : 0;
  if (leftArchived !== rightArchived) return leftArchived - rightArchived;
  const leftAt = Date.parse(left.updatedAt) || 0;
  const rightAt = Date.parse(right.updatedAt) || 0;
  if (leftAt !== rightAt) return rightAt - leftAt;
  return left.title.localeCompare(right.title);
};

export const sortTaskBoardCards = (cards: TaskBoardCard[]): TaskBoardCard[] =>
  [...cards].sort(compareCards);

const taskBoardCardsEqual = (a: TaskBoardCard, b: TaskBoardCard): boolean =>
  a.id === b.id &&
  a.title === b.title &&
  a.description === b.description &&
  a.status === b.status &&
  a.source === b.source &&
  a.sourceEventId === b.sourceEventId &&
  a.assignedAgentId === b.assignedAgentId &&
  a.createdAt === b.createdAt &&
  a.updatedAt === b.updatedAt &&
  a.playbookJobId === b.playbookJobId &&
  a.runId === b.runId &&
  a.channel === b.channel &&
  a.externalThreadId === b.externalThreadId &&
  a.lastActivityAt === b.lastActivityAt &&
  a.isArchived === b.isArchived &&
  a.isInferred === b.isInferred &&
  a.notes.length === b.notes.length &&
  a.notes.every((note, index) => note === b.notes[index]);

export const upsertTaskBoardCard = (
  cards: TaskBoardCard[],
  nextCard: TaskBoardCard,
): TaskBoardCard[] => {
  const cardId = nextCard.id.trim();
  if (!cardId) return cards;
  const existingIndex = cards.findIndex((card) => card.id === cardId);
  if (existingIndex < 0) return sortTaskBoardCards([...cards, nextCard]);
  // Return the SAME array reference when the card is structurally unchanged.
  // Otherwise every upsert of an identical card (e.g. the 4s shared-task poll or
  // playbook rebuild) produced a fresh cards array, re-triggering every
  // state.cards-dependent effect and driving a re-render loop that pegged the
  // CPU (and, before the syncCardWithLinkedRun fix, OOM'd the renderer) at 60fps.
  if (taskBoardCardsEqual(cards[existingIndex], nextCard)) return cards;
  const next = [...cards];
  next[existingIndex] = nextCard;
  return sortTaskBoardCards(next);
};

export const taskBoardReducer = (
  state: TaskBoardPreference = defaultTaskBoardPreference(),
  action: TaskBoardAction,
): TaskBoardPreference => {
  switch (action.type) {
    case "hydrate":
      return {
        cards: sortTaskBoardCards(action.preference.cards),
        selectedCardId: action.preference.selectedCardId,
      };
    case "upsert": {
      const cards = upsertTaskBoardCard(state.cards, action.card);
      // Same reference → nothing changed → return the same state so useReducer
      // bails out of the re-render (prevents the dispatch-churn loop).
      return cards === state.cards ? state : { ...state, cards };
    }
    case "upsertMany": {
      let cards = state.cards;
      for (const card of action.cards) {
        cards = upsertTaskBoardCard(cards, card);
      }
      return cards === state.cards ? state : { ...state, cards };
    }
    case "update": {
      const existing = state.cards.find((card) => card.id === action.cardId);
      if (!existing) return state;
      return {
        ...state,
        cards: upsertTaskBoardCard(state.cards, {
          ...existing,
          ...action.patch,
          updatedAt: action.patch.updatedAt ?? new Date().toISOString(),
        }),
      };
    }
    case "move": {
      const existing = state.cards.find((card) => card.id === action.cardId);
      if (!existing) return state;
      return {
        ...state,
        cards: upsertTaskBoardCard(state.cards, {
          ...existing,
          status: action.status,
          updatedAt: new Date().toISOString(),
        }),
      };
    }
    case "remove": {
      const cards = state.cards.filter((card) => card.id !== action.cardId);
      return {
        cards,
        selectedCardId:
          state.selectedCardId === action.cardId ? cards[0]?.id ?? null : state.selectedCardId,
      };
    }
    case "select":
      return {
        ...state,
        selectedCardId: action.cardId,
      };
    default:
      return state;
  }
};
