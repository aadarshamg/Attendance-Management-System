import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SiteInputDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @MinLength(1) @MaxLength(500) address!: string;
  @IsNumber() @Min(-90) @Max(90) geofenceCenterLat!: number;
  @IsNumber() @Min(-180) @Max(180) geofenceCenterLng!: number;
  @IsInt() @Min(1) @Max(10000) geofenceRadiusM!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
