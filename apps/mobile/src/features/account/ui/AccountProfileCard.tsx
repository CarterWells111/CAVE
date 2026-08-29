import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";

export type AccountProfileCardProps = {
  status: "signedOut" | "loading" | "ready" | "error";
  email?: string;
  displayName?: string;
  avatarUri?: string;
  readOnly?: boolean;
  onSignIn?(): void;
  onChangeAvatar?(): void;
  onChangeDisplayName?(): void;
  onRetry?(): void;
};

function Avatar({ uri, editable }: { uri?: string; editable: boolean }) {
  const theme = useTheme();
  if (uri !== undefined) {
    return (
      <Image
        accessible={!editable}
        accessibilityLabel={editable ? undefined : "账号头像"}
        source={{ uri }}
        style={{
          backgroundColor: theme.color.surfaceMuted,
          borderColor: theme.color.border,
          borderRadius: theme.radius.pill,
          borderWidth: theme.border.width,
          height: 72,
          width: 72,
        }}
      />
    );
  }
  return (
    <View
      accessible={!editable}
      accessibilityLabel={editable ? undefined : "默认头像"}
      style={{
        alignItems: "center",
        backgroundColor: theme.color.surfaceAccent,
        borderColor: theme.color.border,
        borderRadius: theme.radius.pill,
        borderWidth: theme.border.width,
        height: 72,
        justifyContent: "center",
        width: 72,
      }}
    >
      <Ionicons accessible={false} color={theme.color.textSecondary} name="person" size={36} />
    </View>
  );
}

export function AccountProfileCard({
  avatarUri,
  displayName,
  email,
  onChangeAvatar,
  onChangeDisplayName,
  onRetry,
  onSignIn,
  readOnly = false,
  status,
}: AccountProfileCardProps) {
  const theme = useTheme();
  const avatarEditable = status === "ready" && !readOnly && onChangeAvatar !== undefined;

  if (status === "loading") {
    return (
      <Card testID="account-profile-card">
        <Text
          accessibilityState={{ busy: true }}
          accessibilityLiveRegion="polite"
          style={{ ...theme.typography.body, color: theme.color.textSecondary }}
        >
          正在读取账号资料…
        </Text>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card accessible={false} testID="account-profile-card">
        <Text accessibilityRole="alert" style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          暂时无法读取账号资料，请稍后重试。
        </Text>
        {onRetry === undefined ? null : <Button label="重试账号资料" onPress={onRetry} />}
      </Card>
    );
  }

  if (status === "signedOut") {
    return (
      <Card accessible={false} testID="account-profile-card">
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.lg }}>
          <Avatar editable={false} />
          <Pressable
            accessibilityRole="button"
            disabled={onSignIn === undefined}
            onPress={onSignIn}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: pressed ? theme.color.primaryPressed : theme.color.primary,
              borderRadius: theme.radius.control,
              justifyContent: "center",
              minHeight: theme.size.minimumTouchTarget,
              minWidth: theme.size.minimumTouchTarget,
              paddingHorizontal: theme.space.lg,
            })}
          >
            <Text style={{ ...theme.typography.button, color: theme.color.onPrimary }}>邮箱登录</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Card
      accessible={readOnly || (onChangeAvatar === undefined && onChangeDisplayName === undefined)}
      testID="account-profile-card"
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.lg }}>
        {avatarEditable ? (
          <Pressable
            accessibilityLabel="更改头像"
            accessibilityRole="button"
            onPress={onChangeAvatar}
            style={{ minHeight: theme.size.minimumTouchTarget, minWidth: theme.size.minimumTouchTarget }}
          >
            <Avatar editable {...(avatarUri === undefined ? {} : { uri: avatarUri })} />
            <View
              pointerEvents="none"
              style={{
                alignItems: "center",
                backgroundColor: theme.color.canvasRaised,
                borderBottomLeftRadius: theme.radius.pill,
                borderBottomRightRadius: theme.radius.pill,
                bottom: 0,
                left: 0,
                paddingVertical: theme.space.xs,
                position: "absolute",
                right: 0,
              }}
            >
              <Text style={{ ...theme.typography.numericLabel, color: theme.color.text }}>点击更改</Text>
            </View>
          </Pressable>
        ) : <Avatar editable={false} {...(avatarUri === undefined ? {} : { uri: avatarUri })} />}
        <View
          style={{ flex: 1, flexDirection: "column", gap: theme.space.xs, minWidth: 0 }}
          testID="account-profile-identity"
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.sm }}>
            <Text
              numberOfLines={2}
              selectable
              style={{ ...theme.typography.heading, color: theme.color.text, flexShrink: 1 }}
            >
              {displayName ?? "内界用户"}
            </Text>
            {!readOnly && onChangeDisplayName !== undefined ? (
              <Pressable
                accessibilityLabel="更改昵称"
                accessibilityRole="button"
                hitSlop={4}
                onPress={onChangeDisplayName}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: theme.size.minimumTouchTarget,
                  minWidth: theme.size.minimumTouchTarget,
                }}
              >
                <Ionicons accessible={false} color={theme.color.textSecondary} name="pencil" size={theme.size.icon} />
              </Pressable>
            ) : null}
          </View>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            {email ?? "邮箱未记录，请重新登录后显示"}
          </Text>
        </View>
      </View>
    </Card>
  );
}
