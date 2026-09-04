import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import {
  type JourneyRuntimeContextValue,
  useOptionalJourneyRuntime,
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { ProfileScreen } from "../../src/features/shell/ui/ProfileScreen";
import { toCardArchiveItems, toReviewArchiveItems } from "../../src/features/shell/ui/profile-archive";
import type { ShellLoadState, ShellMetadataItem } from "../../src/features/shell/ui/shell-ui-components";

export default function ProfileRoute() {
  const runtime = useOptionalJourneyRuntime();
  const account = useAccountProfile();
  return runtime === null
    ? <PublicProfileRoute account={account} />
    : <AuthorizedProfileRoute account={account} runtime={runtime} />;
}

function profileScreenAccount(
  account: ReturnType<typeof useAccountProfile>,
  onSignIn: () => void,
) {
  return {
    status: account.status,
    ...(account.email === undefined ? {} : { email: account.email }),
    ...(account.profile === undefined ? {} : { profile: account.profile }),
    ...(account.status === "signedOut" ? { onSignIn } : {}),
    ...(account.status === "error" ? { onRetry: account.retry } : {}),
  };
}

function PublicProfileRoute({ account }: { account: ReturnType<typeof useAccountProfile> }) {
  const router = useRouter();
  return (
    <Screen>
      <ProfileScreen
        account={profileScreenAccount(account, () => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } }))}
        cards={[]}
        cardsLoadState="ready"
        onOpenSettings={() => router.push("/settings")}
        onOpenJournal={() => router.push("/journal" as never)}
        reviews={[]}
        reviewsLoadState="ready"
      />
    </Screen>
  );
}

function AuthorizedProfileRoute({
  account,
  runtime,
}: {
  account: ReturnType<typeof useAccountProfile>;
  runtime: JourneyRuntimeContextValue;
}) {
  const router = useRouter();
  const { cards, reviewHistory } = runtime;
  const [cardsLoadState, setCardsLoadState] = useState<ShellLoadState>("loading");
  const [cardItems, setCardItems] = useState<ShellMetadataItem[]>([]);
  const [reviewsLoadState, setReviewsLoadState] = useState<ShellLoadState>("loading");
  const [reviewItems, setReviewItems] = useState<ShellMetadataItem[]>([]);
  const cardsRequestId = useRef(0);
  const reviewsRequestId = useRef(0);

  const loadCards = useCallback(async () => {
    const requestId = ++cardsRequestId.current;
    setCardsLoadState("loading");
    try {
      const items = toCardArchiveItems(await cards.listMetadata());
      if (requestId !== cardsRequestId.current) return;
      setCardItems(items);
      setCardsLoadState("ready");
    } catch {
      if (requestId !== cardsRequestId.current) return;
      setCardsLoadState("error");
    }
  }, [cards]);

  const loadReviews = useCallback(async () => {
    const requestId = ++reviewsRequestId.current;
    setReviewsLoadState("loading");
    try {
      const items = toReviewArchiveItems(await reviewHistory.listMetadata());
      if (requestId !== reviewsRequestId.current) return;
      setReviewItems(items);
      setReviewsLoadState("ready");
    } catch {
      if (requestId !== reviewsRequestId.current) return;
      setReviewsLoadState("error");
    }
  }, [reviewHistory]);

  useEffect(() => {
    void loadCards();
    return () => {
      cardsRequestId.current += 1;
    };
  }, [loadCards]);

  useEffect(() => {
    void loadReviews();
    return () => {
      reviewsRequestId.current += 1;
    };
  }, [loadReviews]);

  return (
    <Screen>
      <ProfileScreen
        account={profileScreenAccount(account, () => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } }))}
        cards={cardItems}
        cardsLoadState={cardsLoadState}
        onOpenCard={(id) => router.push(`/cards/${id}`)}
        onOpenReview={(id) => router.push(`/reviews/${id}`)}
        onOpenSettings={() => router.push("/settings")}
        onOpenJournal={() => router.push("/journal" as never)}
        onRetryCards={() => { void loadCards(); }}
        onRetryReviews={() => { void loadReviews(); }}
        reviews={reviewItems}
        reviewsLoadState={reviewsLoadState}
      />
    </Screen>
  );
}
