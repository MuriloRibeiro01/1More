import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../src/i18n';
import { Button, EmptyState, NumberField, RoutineCard, Sheet, Stepper, TextField } from '../src/components';
import { renderComTema } from '../test-utils/render';

// Componentes do DS usados na planilha (T-005): comportamento e acessibilidade.

const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number>;
  return Math.max(s.minHeight ?? 0, s.height ?? 0);
};

beforeAll(() => i18n.changeLanguage('pt-BR'));

describe('Stepper', () => {
  it('é ajustável com o valor formatado e botões −/+ de 48dp', async () => {
    const onChange = jest.fn();
    await renderComTema(<Stepper label="Descanso" value={90} step={15} min={0} max={600} format={(s) => `${s}s`} onChange={onChange} />);
    const ajuste = screen.getByRole('adjustable', { name: 'Descanso' });
    expect(ajuste.props.accessibilityValue).toMatchObject({ text: '90s' });
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar descanso' }));
    expect(onChange).toHaveBeenLastCalledWith(105);
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir descanso' }));
    expect(onChange).toHaveBeenLastCalledWith(75);
    screen.getAllByRole('button').forEach((b) => expect(alvo(b)).toBeGreaterThanOrEqual(48));
  });

  it('para nos limites (botão desabilitado) e responde às ações do leitor de tela', async () => {
    const onChange = jest.fn();
    await renderComTema(<Stepper label="Séries" value={10} min={1} max={10} onChange={onChange} />);
    const mais = screen.getByRole('button', { name: 'Aumentar séries' });
    expect(mais).toBeDisabled();
    await fireEvent(screen.getByRole('adjustable', { name: 'Séries' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).toHaveBeenLastCalledWith(9);
  });
});

describe('NumberField e TextField', () => {
  it('NumberField: rótulo acessível, teclado decimal e seleciona ao focar', async () => {
    const onChange = jest.fn();
    await renderComTema(<NumberField label="Carga alvo (kg)" value="" unit="kg" placeholder="60" onChange={onChange} />);
    const campo = screen.getByLabelText('Carga alvo (kg)');
    expect(campo.props.keyboardType).toBe('decimal-pad');
    expect(campo.props.selectTextOnFocus).toBe(true);
    await fireEvent.changeText(campo, '82,5');
    expect(onChange).toHaveBeenCalledWith('82,5');
  });

  it('NumberField sem decimal usa teclado numérico', async () => {
    await renderComTema(<NumberField label="Repetições mínimas" decimal={false} />);
    expect(screen.getByLabelText('Repetições mínimas').props.keyboardType).toBe('number-pad');
  });

  it('TextField: rótulo visível e acessível', async () => {
    const onChange = jest.fn();
    await renderComTema(<TextField label="Nome da rotina" value="" onChange={onChange} hint="Até 80 caracteres" />);
    expect(screen.getByText('Nome da rotina')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nome da rotina'), 'Treino A');
    expect(onChange).toHaveBeenCalledWith('Treino A');
    expect(screen.getByText('Até 80 caracteres')).toBeOnTheScreen();
  });
});

describe('Sheet', () => {
  it('mostra título e ações só quando aberta', async () => {
    const { rerender } = await renderComTema(
      <Sheet open={false} title="Descartar alterações?">
        <Button block>Descartar</Button>
      </Sheet>,
    );
    expect(screen.queryByText('Descartar alterações?')).toBeNull();
    await rerender(
      <Sheet open title="Descartar alterações?">
        <Button block>Descartar</Button>
      </Sheet>,
    );
    expect(screen.getByRole('header', { name: 'Descartar alterações?' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeOnTheScreen();
  });
});

describe('EmptyState e RoutineCard', () => {
  it('EmptyState: título, frase e ação', async () => {
    await renderComTema(<EmptyState title="Caderno novo" body="Monte sua primeira rotina." action={<Button>Nova rotina</Button>} />);
    expect(screen.getByRole('header', { name: 'Caderno novo' })).toBeOnTheScreen();
    expect(screen.getByText('Monte sua primeira rotina.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova rotina' })).toBeOnTheScreen();
  });

  it('RoutineCard: abre ao tocar, lista os exercícios e só mostra "Começar" com onStart', async () => {
    const onOpen = jest.fn();
    const { rerender } = await renderComTema(<RoutineCard name="Treino A" exercises={['Supino', 'Crucifixo']} onOpen={onOpen} />);
    const card = screen.getByRole('button', { name: /Treino A/ });
    expect(alvo(card)).toBeGreaterThanOrEqual(48);
    expect(screen.getByText(/Supino · Crucifixo/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
    await fireEvent.press(card);
    expect(onOpen).toHaveBeenCalled();

    const onStart = jest.fn();
    await rerender(<RoutineCard letter="A" name="Treino A" onOpen={onOpen} onStart={onStart} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
    expect(onStart).toHaveBeenCalled();
    expect(screen.getByText('A')).toBeOnTheScreen();
  });
});

