import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ParseIntentDto {
  @ApiProperty({
    example: 'Đặt cho tôi phòng họp A vào lúc 14:00 chiều mai trong 2 tiếng',
    description: 'Câu lệnh văn bản tự nhiên bằng tiếng Việt hoặc tiếng Anh',
  })
  @IsString({ message: 'Prompt phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Nội dung yêu cầu không được để trống' })
  @MaxLength(500, { message: 'Nội dung yêu cầu tối đa 500 ký tự' })
  prompt: string;
}
