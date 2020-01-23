#!/usr/bin/env ruby

require 'json'
require 'tmpdir'
require 'pathname'
require 'optparse'

class VideoPos
  include Comparable

  def initialize(ms)
    @ms = ms
  end

  def <=>(other)
    @ms <=> other.ms
  end

  def -(other)
    VideoPos.new(ms - other.ms)
  end

  def +(other)
    VideoPos.new(ms + other.ms)
  end

  def in_ms
    @ms
  end

  def in_sec
    in_ms / 1000
  end

  def in_ffmpeg_format
    sprintf("%d.%02d", in_sec, (in_ms % 1000) / 10)
  end

  def to_s
    sprintf('%d:%02d.%02d', in_sec / 60, in_sec % 60, (in_ms % 1000) / 10)
  end

  def self.from_ms(ms)
    VideoPos.new(ms)
  end

  def self.from_splited_ffmpeg_format(hour, minute, second, second_decimal)
    sec = hour * 3600 + minute * 60 + second
    ms = (sec * 1000) + second_decimal * 10
    VideoPos.new(ms)
  end

  ZERO = VideoPos.new(0).freeze

  attr_reader :ms
end

class VideoPosRange
  def initialize(first, last)
    @first, @last = first, last
  end

  def cover?(pos)
    @first <= pos && pos <= @last
  end

  attr_reader :first, :last
end

Source = Struct.new("Source", :file, :pos)

class SourcePicker
  def initialize(src_file, duration = VideoPos.new(0), force_pos = nil)
    @src_file = src_file
    @duration = duration
    @force_pos = force_pos
  end

  def pick
    @force_pos ? Source.new(@src_file, @force_pos) : Source.new(@src_file, pick_video_frame(@src_file))
  end

private
  def pick_video_frame(fn)
    duration = get_video_duration(fn) - @duration - VideoPos.new(1000)
    VideoPos.new(rand(0..duration.in_ms))
  end

  def get_video_duration(fn)
    out = IO.popen(['ffprobe', '-i', fn], err: [:child, :out]) do |io|
      io.each_line(chomp: true).grep(/Duration/).first
    end
    out.strip =~ /^Duration: (\d\d):(\d\d):(\d\d).(\d\d)/ or raise "#{fn} の長さを取得できませんでした。"
    VideoPos.from_splited_ffmpeg_format($1.to_i, $2.to_i, $3.to_i, $4.to_i)
  end
end

class SourcePickerWithBlacklist < SourcePicker
  def initialize(src_file, blacklist, duration = VideoPos.new(0))
    super(src_file, duration)
    @blacklist = blacklist
  end

  def pick_video_frame(fn)
    black_range = @blacklist
    duration = get_video_duration(fn) - @duration - VideoPos.new(1000)

    while moment = VideoPos.new(rand(0..duration.in_ms))
      if !black_range.any? { |i| i.cover?(moment) }
        return moment
      end
    end
  end
end

class ImageGenerator
  def generate(src, out_fn)
    system(*%W(ffmpeg -loglevel fatal -y -ss #{src.pos.in_ffmpeg_format} -i #{src.file} -vframes 1 #{out_fn}))
  end

  def type
    :image
  end
end

class MosaicGenerator < ImageGenerator
  def initialize(rate, save_original_at = nil)
    @rate = rate
    @save_original_at = save_original_at
  end

  def generate(src, out_fn)
    Dir.mktmpdir do |dir|
      out_fn_org = File.join(dir, 'original.bmp')
      super(src, out_fn_org)
      if @save_original_at
        system(*%W(
          convert #{out_fn_org}
          #{@save_original_at}
        ))
      end
      system(*%W(
        convert #{out_fn_org}
        -sample #{@rate}%
        -sample #{100 / (@rate / 100.0)}%
        #{out_fn}
      ))
    end
  end
end


class AudioGenerator
  def initialize(duration)
    @duration = duration
  end

  def generate(src, out_fn)
    system(*%W(
      ffmpeg -loglevel fatal -y
      -ss #{src.pos.in_ffmpeg_format}
      -i #{src.file}
      -t #{@duration.in_ffmpeg_format}
      -map_metadata -1
      #{out_fn}
    ))
  end

  def type
    :audio
  end
end

class AudioGeneratorWithSilenceRemove < AudioGenerator
  def generate(src, out_fn)
    system(*%W(
      ffmpeg -loglevel fatal -y
      -ss #{src.pos.in_ffmpeg_format}
      -i #{src.file}
      -af silenceremove=start_periods=1:start_threshold=0.005
      -t #{@duration.in_ffmpeg_format}
      -map_metadata -1
      #{out_fn}
    ))
  end
end

class Runner
  def initialize(source_picker, generator)
    @source_picker = source_picker
    @generator = generator
  end

  def run(output_path)
    src = @source_picker.pick
    unless @generator.generate(src, output_path)
      throw 'ジェネレーターはエラーを返しました'
      return src
    end
    src
  end

  def type
    @generator.type
  end
end

def parse_exclude_range(str)
  str.split(',').map { _1.split('..') }.map { VideoPosRange.new(VideoPos.from_ms(_1.to_i), VideoPos.from_ms(_2.to_i)) }
end

def parse_commandline(argv)
  op = OptionParser.new
  options = {
    exclude_ranges: [],
    save_original_at: nil,
  }

  op.on('-r EXCLUDE_RANGE') { |v| options[:exclude_ranges] = parse_exclude_range(v) }
  op.on('-o ORIGINAL_PATH') { |v| options[:save_original_at] = v }

  remain_argv = op.parse(argv)
  return options, remain_argv
end

def main
  opts, args = parse_commandline(ARGV)
  if args.size < 3
    puts 'usage: program [options] mode input_file output_path'
    exit 1
  end

  sp = -> (ms) {  }

  runners = {
    image: Runner.new(
      SourcePickerWithBlacklist.new(args[1], opts[:exclude_ranges]),
      ImageGenerator.new()),
    mosaic: Runner.new(
      SourcePickerWithBlacklist.new(args[1], opts[:exclude_ranges]),
      MosaicGenerator.new(1, opts[:save_original_at])),
    audio: Runner.new(
      SourcePickerWithBlacklist.new(args[1], opts[:exclude_ranges], VideoPos.from_ms(5000)),
      AudioGenerator.new(VideoPos.from_ms(5000))),
    music: Runner.new(
      SourcePickerWithBlacklist.new(args[1], opts[:exclude_ranges], VideoPos.from_ms(1000)),
      AudioGenerator.new(VideoPos.from_ms(1000))),
    intro: Runner.new(
      SourcePicker.new(args[1], VideoPos.from_ms(100), VideoPos::ZERO),
      AudioGeneratorWithSilenceRemove.new(VideoPos.from_ms(100)))
  }

  mode = args[0].to_sym

  unless runners.keys.include?(mode)
    STDERR.puts "不明なモードです"
    exit 1
  end
  runner = runners[mode]

  src = runner.run(args[2])

  print JSON.dump({
    time: src.pos
  })
end

main
