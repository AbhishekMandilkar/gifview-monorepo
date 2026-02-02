import { Button } from "heroui-native";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function InterestsScreen() {
  const router = useRouter();
  return (
    <Container
      footer={
        <View className="px-6 pt-4 pb-6 border-t border-border">
          <Button
            variant="primary"
            onPress={() => {
              // Navigate to auth screen
              router.push("/auth");
            }}
          >
            Proceed
          </Button>
        </View>
      }
    >
      <Text className="text-foreground text-2xl font-bold mb-4">
        Select Your Interests
      </Text>
      <Text className="text-muted mb-8">
        Choose topics you&apos;re interested in to personalize your experience
      </Text>
    </Container>
  );
}
