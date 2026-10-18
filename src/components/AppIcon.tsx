import { HugeiconsIcon, type HugeiconsProps } from '@hugeicons/react-native';
import Activity01Icon from '@hugeicons/core-free-icons/Activity01Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowRight02Icon from '@hugeicons/core-free-icons/ArrowRight02Icon';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import ArrowDownRight01Icon from '@hugeicons/core-free-icons/ArrowDownRight01Icon';
import ChartColumnIcon from '@hugeicons/core-free-icons/ChartColumnIcon';
import BatteryCharging01Icon from '@hugeicons/core-free-icons/BatteryCharging01Icon';
import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import ArrowUp01Icon from '@hugeicons/core-free-icons/ArrowUp01Icon';
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon';
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon';
import LinkSquare02Icon from '@hugeicons/core-free-icons/LinkSquare02Icon';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import ViewOffIcon from '@hugeicons/core-free-icons/ViewOffIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Key01Icon from '@hugeicons/core-free-icons/Key01Icon';
import LockKeyIcon from '@hugeicons/core-free-icons/LockKeyIcon';
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import Remove01Icon from '@hugeicons/core-free-icons/Remove01Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import AddCircleIcon from '@hugeicons/core-free-icons/AddCircleIcon';
import RefreshIcon from '@hugeicons/core-free-icons/RefreshIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Settings03Icon from '@hugeicons/core-free-icons/Settings03Icon';
import Tag01Icon from '@hugeicons/core-free-icons/Tag01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import ChartIncreaseIcon from '@hugeicons/core-free-icons/ChartIncreaseIcon';
import UserIcon from '@hugeicons/core-free-icons/UserIcon';
import WifiDisconnected01Icon from '@hugeicons/core-free-icons/WifiDisconnected01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import FlashIcon from '@hugeicons/core-free-icons/FlashIcon';
import Car01Icon from '@hugeicons/core-free-icons/Car01Icon';
import ThermometerIcon from '@hugeicons/core-free-icons/ThermometerIcon';
import FloppyDiskIcon from '@hugeicons/core-free-icons/FloppyDiskIcon';
import Maximize01Icon from '@hugeicons/core-free-icons/Maximize01Icon';
import Minimize01Icon from '@hugeicons/core-free-icons/Minimize01Icon';
import Loading03Icon from '@hugeicons/core-free-icons/Loading03Icon';
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon';
import WindPowerIcon from '@hugeicons/core-free-icons/WindPowerIcon';
import PowerServiceIcon from '@hugeicons/core-free-icons/PowerServiceIcon';
import WaterEnergyIcon from '@hugeicons/core-free-icons/WaterEnergyIcon';
import Notification03Icon from '@hugeicons/core-free-icons/Notification03Icon';
import DashboardSquare01Icon from '@hugeicons/core-free-icons/DashboardSquare01Icon';
import Square01Icon from '@hugeicons/core-free-icons/Square01Icon';
import OvenIcon from '@hugeicons/core-free-icons/OvenIcon';
import WashingMachineIcon from '@hugeicons/core-free-icons/WashingMachineIcon';
import RefrigeratorIcon from '@hugeicons/core-free-icons/RefrigeratorIcon';

const icons = {
  'oven': OvenIcon,
  'washing-machine': WashingMachineIcon,
  'refrigerator': RefrigeratorIcon,
  'square': Square01Icon,
  'activity': Activity01Icon,
  'arrow-left': ArrowLeft01Icon,
  'arrow-right': ArrowRight01Icon,
  'arrow-right-circle': ArrowRight02Icon,
  'arrow-up-right': ArrowUpRight01Icon,
  'arrow-down-right': ArrowDownRight01Icon,
  'bar-chart-2': ChartColumnIcon,
  'battery-charging': BatteryCharging01Icon,
  'calendar': Calendar03Icon,
  'check': Tick02Icon,
  'chevron-down': ArrowDown01Icon,
  'chevron-up': ArrowUp01Icon,
  'chevron-left': ArrowLeft01Icon,
  'chevron-right': ArrowRight01Icon,
  'clock': Clock01Icon,
  'edit-2': Edit02Icon,
  'external-link': LinkSquare02Icon,
  'eye': ViewIcon,
  'eye-off': ViewOffIcon,
  'home': Home01Icon,
  'key': Key01Icon,
  'lock': LockKeyIcon,
  'log-out': Logout01Icon,
  'mail': Mail01Icon,
  'map-pin': Location01Icon,
  'minus': Remove01Icon,
  'moon': Moon02Icon,
  'plus': Add01Icon,
  'plus-circle': AddCircleIcon,
  'refresh-cw': RefreshIcon,
  'search': Search01Icon,
  'sliders': Settings03Icon,
  'tag': Tag01Icon,
  'trash-2': Delete02Icon,
  'trending-up': ChartIncreaseIcon,
  'user': UserIcon,
  'wifi-off': WifiDisconnected01Icon,
  'x': Cancel01Icon,
  'zap': FlashIcon,
  'truck': Car01Icon,
  'thermometer': ThermometerIcon,
  'save': FloppyDiskIcon,
  'maximize-2': Maximize01Icon,
  'minimize-2': Minimize01Icon,
  'loader': Loading03Icon,
  'alert-circle': AlertCircleIcon,
  'wind': WindPowerIcon,
  'power': PowerServiceIcon,
  'droplet': WaterEnergyIcon,
  'bell': Notification03Icon,
  'grid-outline': DashboardSquare01Icon,
  'grid': DashboardSquare01Icon,
  'home-outline': Home01Icon,
  'water-outline': WaterEnergyIcon,
  'water': WaterEnergyIcon,
  'car-sport-outline': Car01Icon,
  'car-sport': Car01Icon,
  'person-outline': UserIcon,
  'person': UserIcon,
} as const;

export type AppIconName = keyof typeof icons;
export function AppIcon({ name, size = 24, strokeWidth = 1.75, ...props }: Omit<HugeiconsProps, 'icon'> & { name: AppIconName }) {
  return <HugeiconsIcon icon={icons[name]} size={size} strokeWidth={strokeWidth} accessible={false} {...props} />;
}
