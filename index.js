/**
 * @flow
 */
import React, { PureComponent } from 'react';
import {
  StyleSheet,
  Animated,
  Text,
  View,
  ScrollView,
  NativeModules,
  findNodeHandle,
} from 'react-native';

import type { StyleObj } from '../../node_modules/react-native/Libraries/StyleSheet/StyleSheetTypes';

const { UIManager } = NativeModules;

type Props = {
  /**
   * style
   */
  style?: StyleObj,
  /**
   * Number of milliseconds until animation finishes from start.
   */
  speed?: number,
  /**
   * Set this true when animation repeats.
   */
  loop?: boolean,
  /**
   * Set this true while waiting for new data from a refresh.
   */
  marqueeOnStart?: boolean,
  /**
   * Number of milliseconds to wait before resetting the marquee position after it finishes.
   */
  marqueeResetDelay?: number,
  /**
   * Number of milliseconds to wait before starting or restarting marquee.
   */
  marqueeDelay?: number,
  /**
   * Callback function for when the marquee completes its animation
   */
  onMarqueeComplete?: Function,
  /**
   * Text passed
   */
  children: string,
  /**
   * Set this truenif you want to use native driver
   */
  useNativeDriver: boolean,
};

type DefaultProps = {
  style: StyleObj,
  speed: number,
  loop: boolean,
  marqueeOnStart: boolean,
  marqueeResetDelay: number,
  marqueeDelay: number,
  onMarqueeComplete: Function,
};

type State = {
  animating: boolean,
};

export default class MarqueeText extends PureComponent<DefaultProps, Props, State> {
  props: Props;
  state: State;

  distance: ?number;
  contentFits: boolean;
  animatedValue: Object;
  textRef: ?Text;
  scrollViewRef: ?ScrollView;
  timer: ?number;

  static defaultProps = {
    style: {},
    speed: 100,
    loop: false,
    marqueeOnStart: false,
    marqueeDelay: 0,
    marqueeResetDelay: 0,
    onMarqueeComplete: () => {},
    useNativeDriver: true,
  };

  constructor(props: Props) {
    super(props);

    this.animatedValue = new Animated.Value(0);
    this.contentFits = false;
    this.distance = null;
    this.textRef = null;
    this.scrollViewRef = null;

    this.state = {
      animating: false,
    };

    this.invalidateMetrics();
  }

  componentDidMount() {
    const { marqueeDelay } = this.props;
    if (this.props.marqueeOnStart) {
      this.startAnimation(marqueeDelay);
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.children !== nextProps.children) {
      this.invalidateMetrics();
      this.resetAnimation();
    }
  }

  componentWillUnmount() {
    if (this.state.animating) {
      this.stopAnimation();
    }
    this.clearTimeout();
  }

  startAnimation(timeDelay: number) {
    if (this.state.animating) {
      return;
    }

    this.start(timeDelay);
  }

  stopAnimation() {
    this.stop();
  }

  /**
   * Resets the marquee and restarts it after `marqueeDelay` millisecons.
   */
  resetAnimation() {
    const marqueeResetDelay = Math.max(100, this.props.marqueeResetDelay);
    this.animatedValue.setValue(0);
    this.setState({ animating: false }, () => {
      this.startAnimation(marqueeResetDelay);
    });
  }

  start(timeDelay: number) {
    const { speed, loop, onMarqueeComplete, useNativeDriver } = this.props;

    const callback = () => {
      this.calculateMetrics();

      if (!this.contentFits) {
        this.setState({
          animating: true,
        });

        Animated.timing(this.animatedValue, {
          toValue: -this.distance,
          duration: this.distance / speed * 1000,
          useNativeDriver,
        }).start(({ finished }) => {
          if (finished) {
            if (loop) {
              this.resetAnimation();
            } else {
              this.stop();
              onMarqueeComplete();
            }
          }
        });
      }
    };

    this.setTimeout(callback, timeDelay);
  }

  stop() {
    this.animatedValue.setValue(0);
    this.setState({ animating: false });
  }

  shouldAnimate(distance: number) {
    return distance > 0;
  }

  async calculateMetrics() {
    try {
      this.distance = await this.calculateDistance();
      this.contentFits = !this.shouldAnimate(this.distance);
      // console.log(`distance: ${this.distance}, contentFits: ${this.contentFits}`);
    } catch (error) {
      console.warn(error);
    }
  }

  async calculateDistance() {
    const measureWidth = node =>
      new Promise(resolve => {
        UIManager.measure(findNodeHandle(node), (x, y, w) => {
          console.log('Width: ' + w);
          return resolve(w);
        });
      });

    try {
      const [containerWidth, textWidth] = await Promise.all([
        measureWidth(this.scrollViewRef),
        measureWidth(this.textRef),
      ]);
      // return Math.floor(results[1] - results[0]);
      return containerWidth - textWidth;
    } catch (error) {
      return new Error(error);
    }
  }

  invalidateMetrics() {
    // Null distance is the special value to allow recalculation
    this.distance = null;
    // Assume the marquee does not fit until calculations show otherwise
    this.contentFits = false;
  }

  /**
   * Clears the timer
   */
  clearTimeout() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      // console.log("Currently running timeout is cleared!!!");
    }
  }

  /**
   * Starts a new timer
    */
  setTimeout(fn: Function, time: number = 0) {
    this.clearTimeout();
    this.timer = setTimeout(fn, time);
  }

  render() {
    const { children, style, ...rest } = this.props;
    const { animating } = this.state;
    const { width, height } = StyleSheet.flatten(style);

    return (
      <View style={[styles.container, { width, height }]}>
        <ScrollView
          ref={c => (this.scrollViewRef = c)}
          showsHorizontalScrollIndicator={false}
          horizontal
          scrollEnabled={false}
          onContentSizeChange={() => this.calculateMetrics()}
        >
          <Animated.Text
            ref={c => (this.textRef = c)}
            numberOfLines={1}
            {...rest}
            style={[style, { transform: [{ translateX: this.animatedValue }] }]}
          >
            {children}
          </Animated.Text>
        </ScrollView>
        {!animating ? (
          <Text numberOfLines={1} display="none" style={[styles.overlayText, style]} {...rest}>
            {children}
          </Text>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  overlayText: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'blue',
  },
});
