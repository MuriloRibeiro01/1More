import { StyleSheet, Text, View } from 'react-native';
import { text, useTheme } from '../theme';
import { Linha } from './Linha';

export interface LivroCaixaProps {
  rotulo: string;
  /** Já formatado (pt-BR): "12.340 kg". */
  valor: string;
}

/** Valor em livro-caixa: "Volume ........ 12.340 kg". Os pontos são só desenho, fora da leitura de tela. */
export function LivroCaixa({ rotulo, valor }: LivroCaixaProps) {
  const { colors: c } = useTheme();

  return (
    <View accessible accessibilityLabel={`${rotulo}: ${valor}`}>
      <Linha>
        <View style={styles.linha}>
          <Text style={[styles.rotulo, { color: c.ink }]}>{rotulo}</Text>
          {/* Pontos em excesso, cortados pelo flex: sempre preenchem o vão entre rótulo e valor. */}
          <Text numberOfLines={1} style={[styles.pontos, { color: c.inkMuted }]}>
            {'.'.repeat(120)}
          </Text>
          <Text style={[styles.valor, { color: c.ink }]}>{valor}</Text>
        </View>
      </Linha>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  rotulo: { ...text.bodyStrong },
  pontos: { ...text.body, flex: 1, overflow: 'hidden' },
  valor: { ...text.numMd },
});
