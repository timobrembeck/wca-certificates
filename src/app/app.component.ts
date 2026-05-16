import {Component, ViewEncapsulation} from '@angular/core';
import {ApiService} from '../common/api';
import {PrintService} from '../common/print';
import {Event} from '@wca/helpers/lib/models/event';
import {Round} from '@wca/helpers/lib/models/round';
import {Result} from '@wca/helpers/lib/models/result';
import {Person} from '@wca/helpers';
import {Helpers} from '../common/helpers';
import { environment } from '../environments/environment';
import { WcaApiResult } from '../common/types';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  state: 'PRINT' | 'REFRESHING' = 'PRINT';

  dualRoundEvents: Set<string> = new Set();

  // Info about competitions managed by user
  competitionsToChooseFrom: Array<String> = null;
  competitionId: string;
  customCompetitionId: string;
  events: Event[];
  wcif: any;
  personsWithAResult: Person[];
  acceptedPersons: number;
  error: string;
  loading: boolean;

  constructor (
          public apiService: ApiService,
          public printService: PrintService) {
      this.readUrlParams();
      if (this.apiService.oauthToken) {
        this.handleGetCompetitions();
      }
  }

  handleLoginToWca() {
    this.apiService.logIn();
  }

  handleGetCompetitions() {
    this.apiService.getRecentCompetitions().subscribe(comps => {
      this.competitionsToChooseFrom = comps.map(c => c['id']);
    });
  }

  handleCompetitionSelected(competitionId: string) {
    this.competitionId = competitionId;
    this.updateUrl(competitionId);
    this.loadWcif(this.competitionId);
  }

  private readUrlParams(): void {
    const params = new URLSearchParams(window.location.search);
    const competitionId = params.get('competition');
    if (competitionId && this.apiService.oauthToken) {
      this.competitionId = competitionId;
      this.loadWcif(competitionId);
    }
  }

  private updateUrl(competitionId: string): void {
    const params = new URLSearchParams();
    params.set('competition', competitionId);
    history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  handleRefreshCompetition() {
    this.state = 'REFRESHING';
    this.loadWcif(this.competitionId);
  }

  private loadWcif(competitionId: string) {
    this.loading = true;
    this.apiService.getWcif(this.competitionId).subscribe(wcif => {
      this.wcif = wcif;
      const hasResults = wcif.events.some(e =>
        e.rounds.some(r => r.results && r.results.length > 0)
      );
      if (hasResults) {
        this.processWcifResults(wcif, competitionId);
      } else {
        this.apiService.getResults(this.competitionId).subscribe(
          apiResults => {
            if (apiResults && apiResults.length > 0) {
              this.mergeResultsIntoWcif(wcif, apiResults);
            }
            this.processWcifResults(wcif, competitionId);
          },
          () => this.processWcifResults(wcif, competitionId)
        );
      }
    }, (error: any) => {
      this.loading = false;
      this.error = error?.error?.error || error?.message;
    });
  }

  private processWcifResults(wcif: any, competitionId: string) {
    this.loading = false;
    try {
      this.acceptedPersons = wcif.persons.filter(p => !!p.registration && p.registration.status === 'accepted').length;
      this.events = wcif.events;
      this.events.forEach(function(e) {
        e.rounds.forEach(function(r) {
          r.results.forEach(function(result) {
            const personOfResult: Person = wcif.persons.filter(p => p.registrantId === result.personId)[0];
            if (personOfResult) {
              result['countryIso2'] = personOfResult.countryIso2;
              personOfResult['hasAResult'] = true;
            }
          });
        });
      });
      this.personsWithAResult = wcif.persons.filter(p => !!p['hasAResult']);
      this.loadCompetitionConfig(competitionId);
      this.state = 'PRINT';
    } catch (error) {
      this.loading = false;
      console.error(error);
      this.wcif = null;
      this.competitionId = null;
    }
  }

  private mergeResultsIntoWcif(wcif: any, apiResults: WcaApiResult[]) {
    const byEventRound = new Map<string, WcaApiResult[]>();
    for (const r of apiResults) {
      const key = `${r.event_id}-${r.round_type_id}`;
      if (!byEventRound.has(key)) { byEventRound.set(key, []); }
      byEventRound.get(key)!.push(r);
    }
    const nameToId = new Map<string, number>();
    for (const p of wcif.persons) { nameToId.set(p.name, p.registrantId); }

    for (const event of wcif.events) {
      const total = event.rounds.length;
      for (let i = 0; i < total; i++) {
        const round = event.rounds[i];
        const isLast = i === total - 1;
        let roundResults: WcaApiResult[] | undefined;
        if (isLast) {
          roundResults = byEventRound.get(`${event.id}-f`) ?? byEventRound.get(`${event.id}-c`);
        }
        if (!roundResults) {
          roundResults = byEventRound.get(`${event.id}-${i + 1}`);
        }
        if (!roundResults && i === 0) {
          roundResults = byEventRound.get(`${event.id}-d`);
        }
        if (roundResults && roundResults.length > 0) {
          round.results = roundResults.map(r => ({
            personId: nameToId.get(r.name) ?? 0,
            ranking: r.pos,
            attempts: r.attempts.map(a => ({result: a, reconstruction: null})),
            best: r.best,
            average: r.average,
          }));
        }
      }
    }
  }

  printCertificatesAsPdf() {
    this.printService.printCertificatesAsPdf(this.wcif, this.getSelectedEvents());
  }

  printCertificatesAsZip() {
    this.printService.printCertificatesAsZip(this.wcif, this.getSelectedEvents());
  }

  private getSelectedEvents() {
    return Array.from(this.events.filter(e => e['printCertificate']).map(e => e.id));
  }

  printEmptyCertificate() {
    this.printService.printEmptyCertificate(this.wcif);
  }

  getWarningIfAny(eventId: string): string {
    const event: Event = this.events.filter(e => e.id === eventId)[0];
    let results: Result[] = this.getEffectiveResults(event);
    results = this.filterResultsWithOnlyDNF(results);
    results = this.filterResultsByCountry(results);

    const podiumPlaces = this.getPodiumPlaces(results);
    this.calculateRankingAfterFiltering(podiumPlaces);
    event['podiumPlaces'] = podiumPlaces;

    switch (podiumPlaces.length) {
      case 0:
        return 'Not available yet';
      case 1:
        return 'Only 1 person on the podium!';
      case 2:
        return 'Only 2 persons on the podium!';
      case 3:
        return ''; // No warning
      default:
        return 'More than 3 persons on the podium!';
    }
  }

  private filterResultsWithOnlyDNF(results: Result[]): Result[] {
    return results.filter(r => r['best'] > 0);
  }

  private filterResultsByCountry(results: Result[]): Result[] {
    if (!! this.printService.countries && this.printService.countries.length > 0) {
      return results.filter(r => this.printService.countries.split(';').includes(r['countryIso2']));
    }
    return results;
  }

  private getPodiumPlaces(results: Result[]): Result[] {
    // TODO This needs a test
    Helpers.sortResultsByRanking(results);
    const podiumPlaces = results.slice(0, 3);
    if (podiumPlaces.length === 3) {
      let i = 3;
      while (i < results.length) {
        if (podiumPlaces[i - 1].ranking === results[i].ranking) {
          podiumPlaces.push(results[i]);
        } else {
          break;
        }
        i++;
      }
    }
    return podiumPlaces.reverse();
  }

  private calculateRankingAfterFiltering(podiumPlaces: Result[]): void {
    podiumPlaces.forEach(function(p) {
      p['rankingAfterFiltering'] = podiumPlaces.filter(o => o.ranking < p.ranking).length + 1;
    });
  }

  hasDualRoundOption(event: Event): boolean {
    return event.rounds.length >= 2;
  }

  toggleDualRound(eventId: string): void {
    if (this.dualRoundEvents.has(eventId)) {
      this.dualRoundEvents.delete(eventId);
    } else {
      this.dualRoundEvents.add(eventId);
    }
    this.saveCompetitionConfig();
  }

  saveCompetitionConfig(): void {
    if (!this.competitionId) { return; }
    try {
      localStorage.setItem(`wca-cert.competition.${this.competitionId}`, JSON.stringify({
        dualRoundEvents: Array.from(this.dualRoundEvents),
        selectedEvents: this.events.filter(e => e['printCertificate']).map(e => e.id),
      }));
    } catch { }
  }

  private loadCompetitionConfig(id: string): void {
    this.dualRoundEvents = new Set();
    try {
      const raw = localStorage.getItem(`wca-cert.competition.${id}`);
      if (!raw) { return; }
      const cfg = JSON.parse(raw);
      this.dualRoundEvents = new Set(cfg.dualRoundEvents ?? []);
      const selected: string[] = cfg.selectedEvents ?? [];
      this.events.forEach(e => { e['printCertificate'] = selected.includes(e.id); });
    } catch { }
  }

  private getEffectiveResults(event: Event): Result[] {
    if (this.dualRoundEvents.has(event.id) && event.rounds.length >= 2) {
      return this.mergeDualRoundResults(event.rounds[0], event.rounds[1], event.rounds[1].format);
    }
    return event.rounds[event.rounds.length - 1].results;
  }

  private mergeDualRoundResults(round1: Round, round2: Round, format: string): Result[] {
    const best: {[personId: number]: Result} = {};
    [...round1.results, ...round2.results].forEach(result => {
      if (!best[result.personId] || this.isBetterResult(result, best[result.personId], format)) {
        best[result.personId] = result;
      }
    });
    const merged = Object.values(best);
    this.assignRankings(merged, format);
    return merged;
  }

  private isBetterResult(a: Result, b: Result, format: string): boolean {
    if (format === 'a' || format === 'm') {
      if (a.average > 0 && b.average > 0) { return a.average < b.average; }
      if (a.average > 0) { return true; }
      if (b.average > 0) { return false; }
    }
    if (a.best > 0 && b.best > 0) { return a.best < b.best; }
    if (a.best > 0) { return true; }
    return false;
  }

  private assignRankings(results: Result[], format: string): void {
    results.sort((a, b) => this.isBetterResult(a, b, format) ? -1 : this.isBetterResult(b, a, format) ? 1 : 0);
    let rank = 1;
    results.forEach((r, i) => {
      if (i > 0 && !this.isBetterResult(results[i - 1], r, format) && !this.isBetterResult(r, results[i - 1], format)) {
        r.ranking = results[i - 1].ranking;
      } else {
        r.ranking = rank;
      }
      rank++;
    });
  }

  printDisabled(): boolean {
    return this.events.filter(e => e['printCertificate']).length === 0;
  }

  printParticipationCertificatesAsPdf() {
    this.printService.printParticipationCertificatesAsPdf(this.wcif, this.personsWithAResult);
  }

  printParticipationCertificatesAsZip() {
    this.printService.printParticipationCertificatesAsZip(this.wcif, this.personsWithAResult);
  }

  version() {
    return environment.version;
  }

  checkAllEvents($event: MouseEvent) {
    const checked = ($event.target as HTMLInputElement).checked;
    this.events.forEach(e => {
      e['printCertificate'] = checked;
    });
  }
}
