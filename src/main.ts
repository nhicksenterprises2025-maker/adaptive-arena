import './styles.css';
import { AdaptiveArenaApp, applyStoredBalanceOverrides } from './app';

applyStoredBalanceOverrides();

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Adaptive Arena root element not found');

new AdaptiveArenaApp(root);
