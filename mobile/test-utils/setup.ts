import { configure } from '@testing-library/react-native';

// Suíte pesada (Loki + navegação) em máquina carregada: o padrão de 1 s do RNTL estoura em findBy*/waitFor.
configure({ asyncUtilTimeout: 5000 });
