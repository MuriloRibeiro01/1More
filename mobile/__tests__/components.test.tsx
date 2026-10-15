import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { Button, IconButton, TabBar, TopBar, type TabBarItem } from '../src/components';
import { colors, size } from '../src/theme';
import { renderComTema } from '../test-utils/render';

// expo-font importa expo-asset, que não é resolvível no node_modules atual (achado do T-001); fontes não importam aqui.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

function estilo(el: { props: { style?: unknown } }) {
  return StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
}

describe('Button', () => {
  it('tem role button, rótulo visível e dispara onPress', async () => {
    const onPress = jest.fn();
    await renderComTema(<Button onPress={onPress}>Salvar</Button>);
    const botao = screen.getByRole('button', { name: 'Salvar' });
    await fireEvent.press(botao);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(botao).not.toBeDisabled();
  });

  it('disabled: accessibilityState e sem onPress', async () => {
    const onPress = jest.fn();
    await renderComTema(
      <Button disabled onPress={onPress}>
        Salvar
      </Button>,
    );
    const botao = screen.getByRole('button', { name: 'Salvar' });
    expect(botao).toBeDisabled();
    await fireEvent.press(botao);
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each<['md' | 'lg', number]>([
    ['md', 48],
    ['lg', 56],
  ])('size %s → minHeight %d (alvo ≥ 48dp)', async (tamanho, altura) => {
    await renderComTema(<Button size={tamanho}>Ok</Button>);
    expect(estilo(screen.getByRole('button'))).toMatchObject({ minHeight: altura });
  });

  it('padrão é md (48) e raio ≤ 4', async () => {
    await renderComTema(<Button>Ok</Button>);
    const s = estilo(screen.getByRole('button'));
    expect(s.minHeight).toBe(size.sizeTouch);
    expect(s.borderRadius as number).toBeLessThanOrEqual(4);
  });

  it('primary usa a tinta do tema (Papel e Noite)', async () => {
    const { unmount } = await renderComTema(<Button variant="primary">Ok</Button>, 'light');
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(colors.light.ink);
    await unmount();
    await renderComTema(<Button variant="primary">Ok</Button>, 'dark');
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(colors.dark.ink);
  });

  it('block estica na largura', async () => {
    await renderComTema(<Button block>Ok</Button>);
    expect(estilo(screen.getByRole('button')).alignSelf).toBe('stretch');
  });
});

describe('IconButton', () => {
  it('label vira accessibilityLabel com role button', async () => {
    const onPress = jest.fn();
    await renderComTema(<IconButton icon="close" label="Fechar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 24, 32, 47])('lado nunca menor que 48 (size=%p)', async (lado) => {
    await renderComTema(<IconButton icon="plus" label="Adicionar" size={lado} />);
    expect(estilo(screen.getByRole('button', { name: 'Adicionar' }))).toMatchObject({ width: 48, height: 48 });
  });

  it('size maior que 48 é respeitado', async () => {
    await renderComTema(<IconButton icon="plus" label="Adicionar" size={56} />);
    expect(estilo(screen.getByRole('button', { name: 'Adicionar' }))).toMatchObject({ width: 56, height: 56 });
  });

  it('disabled bloqueia o toque', async () => {
    const onPress = jest.fn();
    await renderComTema(<IconButton icon="plus" label="Adicionar" disabled onPress={onPress} />);
    const botao = screen.getByRole('button', { name: 'Adicionar' });
    expect(botao).toBeDisabled();
    await fireEvent.press(botao);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TopBar', () => {
  it('título com role header e kicker acima', async () => {
    await renderComTema(<TopBar title="Treinar" kicker="QUA · 14 OUT" />);
    expect(screen.getByRole('header', { name: 'Treinar' })).toBeOnTheScreen();
    expect(screen.getByText('QUA · 14 OUT')).toBeOnTheScreen();
  });

  it('sem kicker não renderiza linha vazia; left/right aparecem', async () => {
    await renderComTema(
      <TopBar
        title="Perfil"
        left={<IconButton icon="chevron-left" label="Voltar" />}
        right={<IconButton icon="more" label="Mais" />}
      />,
    );
    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mais' })).toBeOnTheScreen();
  });

  it('compact limita o título a 2 linhas; normal a 1', async () => {
    const { unmount } = await renderComTema(<TopBar title="Supino reto" />);
    expect(screen.getByRole('header').props.numberOfLines).toBe(1);
    await unmount();
    await renderComTema(<TopBar title="Supino reto" compact />);
    expect(screen.getByRole('header').props.numberOfLines).toBe(2);
  });
});

describe('TabBar', () => {
  // O RNTL só acha por role elementos acessíveis; o container tablist (não acessível, para não agrupar as abas) é o pai das tabs.
  const tablist = () => screen.getAllByRole('tab')[0].parent!;

  const ITENS: TabBarItem[] = [
    { id: 'Train', label: 'Treinar', icon: 'notebook' },
    { id: 'History', label: 'Histórico', icon: 'calendar' },
    { id: 'Progress', label: 'Progresso', icon: 'chart' },
    { id: 'Profile', label: 'Perfil', icon: 'user' },
  ];

  it('tablist com uma tab por item, na ordem recebida', async () => {
    await renderComTema(<TabBar items={ITENS} active="Train" />);
    expect(tablist().props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual([
      'Treinar',
      'Histórico',
      'Progresso',
      'Perfil',
    ]);
  });

  it('só a aba ativa fica selected', async () => {
    await renderComTema(<TabBar items={ITENS} active="Progress" />);
    expect(screen.getByRole('tab', { name: 'Progresso' })).toBeSelected();
    for (const nome of ['Treinar', 'Histórico', 'Perfil']) {
      expect(screen.getByRole('tab', { name: nome })).not.toBeSelected();
    }
  });

  it('onChange recebe o id da aba tocada', async () => {
    const onChange = jest.fn();
    await renderComTema(<TabBar items={ITENS} active="Train" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Perfil' }));
    expect(onChange).toHaveBeenCalledWith('Profile');
  });

  it('cada aba tem alvo ≥ 48dp (minHeight = size-tabbar)', async () => {
    await renderComTema(<TabBar items={ITENS} active="Train" />);
    for (const tab of screen.getAllByRole('tab')) {
      expect(estilo(tab).minHeight as number).toBeGreaterThanOrEqual(48);
    }
  });

  it('respeita o inset inferior (barra de gestos)', async () => {
    await renderComTema(<TabBar items={ITENS} active="Train" />);
    expect(estilo(tablist()).paddingBottom).toBe(16);
  });
});
