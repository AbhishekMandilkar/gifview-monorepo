import { cn } from "heroui-native";
import { type PropsWithChildren, type ReactNode } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import Animated, { type AnimatedProps } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedView = Animated.createAnimatedComponent(View);

type Props = AnimatedProps<ViewProps> & {
  className?: string;
  footer?: ReactNode;
  useTopInsets?: boolean;
};

export function Container({ children, className, footer, useTopInsets = false, ...props }: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets();

  return (
    <AnimatedView
      className={cn("flex-1 bg-background", className)}
      style={{
        paddingTop: useTopInsets ? insets.top : 0,
      }}
      {...props}
    >
      <View className="flex-1">
        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        
        {footer && (
          <View style={{ paddingBottom: insets.bottom }}>
            {footer}
          </View>
        )}
      </View>
    </AnimatedView>
  );
}
