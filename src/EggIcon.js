import { Image } from 'react-native';

const EGGS = [
  require('../assets/egg-0.png'),
  require('../assets/egg-1.png'),
  require('../assets/egg-2.png'),
  require('../assets/egg-3.png'),
  require('../assets/egg-4.png'),
];
const CHICK = require('../assets/chick.png');

export default function EggIcon({ total, done, size = 32 }) {
  const source =
    done >= total ? CHICK : EGGS[Math.min(4, Math.ceil((done / total) * 4))];
  return (
    <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
  );
}
