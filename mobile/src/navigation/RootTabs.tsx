import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { TabBar, type TabBarItem } from '../components';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { TrainScreen } from '../screens/TrainScreen';

export type RootTabParamList = {
  Train: undefined;
  History: undefined;
  Progress: undefined;
  Profile: undefined;
};

type TabId = keyof RootTabParamList;

// Ordem e ícones fixos (RNF-08): Treinar · Histórico · Progresso · Perfil.
const TABS = [
  { id: 'Train', labelKey: 'tabs.train', icon: 'notebook', component: TrainScreen },
  { id: 'History', labelKey: 'tabs.history', icon: 'calendar', component: HistoryScreen },
  { id: 'Progress', labelKey: 'tabs.progress', icon: 'chart', component: ProgressScreen },
  { id: 'Profile', labelKey: 'tabs.profile', icon: 'user', component: ProfileScreen },
] as const satisfies readonly { id: TabId; labelKey: string; icon: TabBarItem['icon']; component: () => React.JSX.Element }[];

const Tab = createBottomTabNavigator<RootTabParamList>();

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const items: TabBarItem[] = TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey), icon: tab.icon }));
  const active = state.routes[state.index]?.name ?? 'Train';

  return (
    <TabBar
      items={items}
      active={active}
      onChange={(id) => {
        const route = state.routes.find((r) => r.name === id);
        if (!route) return;
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (id !== active && !event.defaultPrevented) navigation.navigate(id as TabId);
      }}
    />
  );
}

export function RootTabs() {
  return (
    <Tab.Navigator initialRouteName="Train" screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      {TABS.map((tab) => (
        <Tab.Screen key={tab.id} name={tab.id} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
}
