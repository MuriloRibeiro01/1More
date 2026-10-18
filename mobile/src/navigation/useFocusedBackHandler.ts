import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Trata o "voltar" do Android só enquanto a aba desta tela está em foco. A bottom-tab não
 * desmonta as abas: um listener comum continuaria ativo em Histórico/Perfil e engoliria o voltar.
 * `onBack` pode mudar a cada render; o listener sempre chama a versão mais recente.
 */
export function useFocusedBackHandler(onBack: () => void, enabled = true) {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        latest.current();
        return true;
      });
      return () => sub.remove();
    }, [enabled]),
  );
}
