declare module "lunar-javascript" {
  export class Lunar {
    getFestivals(): string[];
  }
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getFestivals(): string[];
    getLunar(): Lunar;
  }
}
