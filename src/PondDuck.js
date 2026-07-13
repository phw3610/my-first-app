import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import { useTheme } from './theme';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 연못 좌표(0~100%)에서의 구역 판정: 중앙 타원 안쪽일수록 깊음
function zoneOf(xPct, yPct) {
  const dx = (xPct - 50) / 50;
  const dy = (yPct - 50) / 42;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) return 'deep';
  if (dist < 0.82) return 'mid';
  return 'shallow';
}

const SPEED_PX_PER_SEC = { deep: 58, mid: 44, shallow: 28 };

export default function PondDuck({ duck, pondSize, feedSignal, onSelect, baseSize }) {
  const C = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const size = baseSize;

  const startPosRef = useRef(null);
  if (!startPosRef.current) {
    const sx = 8 + Math.random() * 84;
    const sy = 10 + Math.random() * 80;
    startPosRef.current = {
      x: (sx / 100) * pondSize.width,
      y: (sy / 100) * pondSize.height,
    };
  }
  const pos = useRef(new Animated.ValueXY(startPosRef.current)).current;
  const curRef = useRef(startPosRef.current);
  const bob = useRef(new Animated.Value(0)).current;
  const diveScale = useRef(new Animated.Value(1)).current;
  const diveOpacity = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const [showRipple, setShowRipple] = useState(false);
  const feedUntilRef = useRef(0);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    bobLoop.start();

    const scheduleNext = (delay) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) moveOnce();
      }, delay);
    };

    const dive = () => {
      setShowRipple(true);
      rippleScale.setValue(0);
      rippleOpacity.setValue(0.55);
      Animated.parallel([
        Animated.timing(diveScale, { toValue: 0.15, duration: 420, useNativeDriver: true }),
        Animated.timing(diveOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(rippleScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]).start(() => {
        if (!mountedRef.current) return;
        setShowRipple(false);
        setTimeout(
          () => {
            if (!mountedRef.current) return;
            Animated.parallel([
              Animated.timing(diveScale, { toValue: 1, duration: 380, useNativeDriver: true }),
              Animated.timing(diveOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
            ]).start(() => {
              if (mountedRef.current) scheduleNext(400 + Math.random() * 1000);
            });
          },
          700 + Math.random() * 700,
        );
      });
    };

    const moveOnce = () => {
      if (!mountedRef.current) return;
      const feeding = Date.now() < feedUntilRef.current;
      let tx, ty;
      if (feeding) {
        tx = clamp(50 + (Math.random() - 0.5) * 34, 8, 92);
        ty = clamp(88 + (Math.random() - 0.5) * 10, 55, 94);
      } else {
        tx = 6 + Math.random() * 88;
        ty = 8 + Math.random() * 84;
      }
      const zone = zoneOf(tx, ty);
      const targetX = (tx / 100) * pondSize.width;
      const targetY = (ty / 100) * pondSize.height;
      const dist = Math.hypot(targetX - curRef.current.x, targetY - curRef.current.y);
      const duration = clamp((dist / SPEED_PX_PER_SEC[zone]) * 1000, 900, 4200);

      Animated.timing(pos, {
        toValue: { x: targetX, y: targetY },
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        curRef.current = { x: targetX, y: targetY };
        if (!finished || !mountedRef.current) return;
        if (zone === 'deep' && !feeding && Math.random() < 0.35) {
          dive();
        } else {
          scheduleNext(300 + Math.random() * 1400);
        }
      });
    };

    scheduleNext(200 + Math.random() * 1500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      bobLoop.stop();
    };
  }, [pondSize.width, pondSize.height]);

  useEffect(() => {
    if (feedSignal) feedUntilRef.current = feedSignal.until;
  }, [feedSignal?.token]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const waddleRot = bob.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

  return (
    <>
      {showRipple && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.ripple,
            {
              width: size * 1.6,
              height: size * 0.6,
              transform: [
                { translateX: Animated.subtract(pos.x, size * 0.3) },
                { translateY: Animated.subtract(pos.y, size * 0.17) },
                { scale: rippleScale },
              ],
              opacity: rippleOpacity,
            },
          ]}
        />
      )}
      <Animated.View
        style={{ position: 'absolute', transform: [{ translateX: pos.x }, { translateY: pos.y }] }}
      >
        <Pressable testID={`duck-${duck.id}`} onPress={() => onSelect(duck)} hitSlop={6}>
          <Animated.View
            style={{
              opacity: diveOpacity,
              transform: [{ translateY: bobY }, { rotate: waddleRot }, { scale: diveScale }],
            }}
          >
            <View style={[s.shadow, { width: size * 0.8, height: size * 0.26 }]} />
            <Image source={require('../assets/chick.png')} style={{ width: size, height: size }} />
            {duck.categoryColor && (
              <View style={[s.catDot, { backgroundColor: duck.categoryColor }]} />
            )}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </>
  );
}

const makeStyles = (C) => ({
  shadow: {
    position: 'absolute',
    bottom: 2,
    left: '10%',
    borderRadius: 999,
    backgroundColor: '#000000',
    opacity: 0.14,
  },
  catDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: C.pond,
  },
  ripple: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
});
