import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'newuser@enterprise.local', description: 'User work email' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Password with minimum 8 characters' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiPropertyOptional({
    example: 'EMPLOYEE',
    enum: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    description: 'Initial role (defaults to EMPLOYEE)',
  })
  @IsOptional()
  @IsString()
  roleName?: string;
}
