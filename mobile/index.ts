import { registerRootComponent } from 'expo';

import App from './src/App';

// registerRootComponent chama AppRegistry.registerComponent('main', () => App)
// e prepara o ambiente tanto no dev client quanto no build nativo.
registerRootComponent(App);
