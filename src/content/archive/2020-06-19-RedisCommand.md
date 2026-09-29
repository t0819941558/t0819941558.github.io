---
title: "RedisCommand"
publishedAt: 2020-06-19
legacyPath: "/2020/06/19/RedisCommand/"
archived: true
---
# [](#RedisCommand记录 "RedisCommand记录")RedisCommand记录

1.mset: 同时为多个键设置值。

```plain
> MSET date "2012.3.30" time "11:00 a.m." weather "sunny"OK
```

2.expire: 设置过期时间

```plain
> expire name 5 # 5s 后过期
```

3.setex: set+expire

```plain
> setex name 5 codehole # 5s 后过期，等价于 set+expire
```

4.setnx: set if not exist

```plain
> setnx name codehole # 如果 name 不存在就执行 set 创建
```

5.incr和incrby: 对整形进行修改

```plain
> incrby age -5
```

6.rpush和lpop: 右进左出 队列操作

```plain
> rpush books python java golang(integer) 3> llen books(integer) 3> lpop books"python"> lpop books"java"> lpop books"golang"> lpop books(nil)
```

7.rpush和rpop: 右进又出 栈操作

```plain
> rpush books python java golang(integer) 3> rpop books"golang"> rpop books"java"> rpop books"python"> rpop books(nil)
```

8.lindex: 相当于 Java 链表的 get(int index)方法
   ltrim: 保留方法，在区间内保留

```plain
> rpush books python java golang(integer) 3> lindex books 1 # O(n) 慎用"java"> lrange books 0 -1 # 获取所有元素，O(n) 慎用1) "python"2) "java"3) "golang"> ltrim books 1 -1 # O(n) 慎用OK> lrange books 0 -11) "java"2) "golang"> ltrim books 1 0 # 这其实是清空了整个列表，因为区间范围长度为负OK> llen books(integer) 0
```
