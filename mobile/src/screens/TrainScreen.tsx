import { useState } from 'react';
import { RoutineEditorScreen } from './RoutineEditorScreen';
import { RoutineListScreen } from './RoutineListScreen';

type View = { name: 'list' } | { name: 'editor'; routineId?: string };

/** Aba Treinar: lista de rotinas ⇄ editor. Navegação por estado, sem pilha (a aba não muda, RNF-08). */
export function TrainScreen() {
  const [view, setView] = useState<View>({ name: 'list' });

  if (view.name === 'editor') {
    return <RoutineEditorScreen routineId={view.routineId} onDone={() => setView({ name: 'list' })} />;
  }
  return (
    <RoutineListScreen onNew={() => setView({ name: 'editor' })} onOpen={(routineId) => setView({ name: 'editor', routineId })} />
  );
}
