import type { JourneyPageId } from "../domain/types";
import type { JourneyApplicationService } from "./journey-application-service";
import {
  canAccessJourneyPage,
  getAdjacentJourneyPage,
  getResumePath
} from "./journey-navigation";

export interface JourneyRouterAdapter {
  replace(path: `/journey/${JourneyPageId}` | "/journey/welcome"): void;
}

export class JourneyRouteCoordinator {
  constructor(
    private readonly service: JourneyApplicationService,
    private readonly router: JourneyRouterAdapter
  ) {}

  guard(page: JourneyPageId): boolean {
    return canAccessJourneyPage(this.service.getSnapshot(), page);
  }

  async goTo(page: JourneyPageId): Promise<void> {
    if (!this.guard(page)) throw new Error(`journey-page-locked:${page}`);
    await this.service.navigateTo(page);
    this.router.replace(`/journey/${page}`);
  }

  async backFrom(page: JourneyPageId): Promise<void> {
    const previous = getAdjacentJourneyPage(page, -1);
    if (previous === null) return;
    await this.goTo(previous);
  }

  resume(): void {
    this.router.replace(getResumePath(this.service.getSnapshot()));
  }

  async restart(): Promise<void> {
    await this.service.resetJourney();
    this.router.replace("/journey/welcome");
  }
}
