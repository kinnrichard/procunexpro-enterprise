import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  companyName: string;

  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  adminUsername: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(100)
  adminPassword: string;

  // When true (default), also create a per-org `developer` SUPERADMIN with a
  // generated password returned once in the response.
  @IsOptional()
  @IsBoolean()
  createDeveloper?: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
