/**
 * Native re-export of React Native's Alert.
 *
 * The web build swaps in alert.web.ts, because react-native-web ships Alert as
 * an empty no-op (`static alert() {}`) — every alert silently does nothing in
 * the browser.
 */
import { Alert } from 'react-native';

export { Alert };
