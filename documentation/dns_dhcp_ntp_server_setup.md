# How to run a DNS + DHCP + NTP server for local IP cam networks

## Why do you need it?
When I first setup my IP cameras it was in an offline environment, both due to security aspects but also due to the fact that they were far away from any internet connected router. However, I quickly realized a few problems with the setup.

* Timestamps. My cameras restarted once in a while for unknown reasons. Maybe it was because of a design choice to keep them healthy or maybe it was just a bug the development team hadn't handled yet. No matter the reason this still meant for me that every time they reset the timestamp for all new videos were reset to 1970-01-01 (and so on). It may not sound as a big issue, but if you look at the video recordings only once every month and all recordings are grouped under 5 days with no reasonable timings (14:45 could be in the middle of the night etc.) it gets annoying quite fast.
* Performance. If the camera can't get a decent timestamp back from the time server, it will try again soon. And again. And again. I have to admit that it's no big performance hit but still rather annoying to have them permanently screaming for time.
* Privacy. I'm just throwing this in here for anybody who reads who has IP cameras connected to the internet. When looking at what time servers my devices tried to access I got rather surprised (even if I should not be). All of them are chinese, even if the camera region setting is set to Europe. Paranoid people like me don't like my devices pinging all over the world just for such basic info.

## Getting into the setup
I will assume that you are running as non-root and prefix all commands that need higher privileges with sudo. Sorry if this makes your eyes bleed (yes, I feel it too).

### Hardware
I used an old Raspberry Pi B+ as a server. You don't need much juice in the device to do this so if you have another device already running some services on your network you may as well run this too. Otherwise, get an old RPI and get kicking. I use Raspbian (nowadays called Rasperberry Pi OS) beacuse it is easy but feel free to use any Linux-based system you want. This guide will assume you are running some sort of Debian-based OS.

### Installing the NTP server
Let's start with the easy one. Just get an NTP server from apt and make sure it starts on boot.
```
sudo apt install ntp
sudo systemctl enable ntp.service
```

I chose the lazy way to not hook up a realtime clock which means that every time I restart the device I need to login and set the date. This looks like this (exchange with correct date, time and timezone):
```
sudo date -s "Sat Jan 2 16:24:11 UTC+1 2021"
```


### Installing the DNS + DHCP server
There is a software called dnsmasq that can handle both DNS and DHCP. The reason we are adding this is really for the DNS part so we can spoof some hosts and trick our cameras to ask us for the time and not some server in China. The DHCP part is just something you get along with it, for better or for worse. I assume you can turn it off and use the DHCP server of your router, but I found it to be easy to have it running on the Pi as well.

First off, this will require our device to have a static IP address. Edit the file _sudo nano /etc/dhcpcd.conf_ with your favourite editor. I use nano for such easy tasks but you may use what editor you'd like.
```
sudo nano /etc/dhcpcd.conf
```

At the end of the file, add the following configurations. If you are using another subnet than 192.168.100.0/255, then adjust the IP addresses accordingly. Same goes if you are using another interface then _eth0_ (for example if you are using some wifi card).
```
# Set static IP
interface eth0
static ip_address=192.168.100.200/24
static routers=192.168.100.1
static domain_name_servers=192.168.100.200 8.8.8.8
```

Let's continue by installing dnsmasq and enable its service
```
sudo apt install dnsmasq
sudo systemctl enable dnsmasq.service
```

Now let's edit the configuration. I usually just copy the old config file as a backup and then write a new file with the options I want.
```
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.old
sudo nano /etc/dnsmasq.conf
```

My dnsmasq.conf looks like this
```
server=192.168.100.1
server=8.8.8.8
listen-address=127.0.0.1
listen-address=192.168.100.200
#no-dhcp-interface=
no-hosts
addn-hosts=/etc/dnsmasq.spoofed.hosts

domain-needed
bogus-priv
domain=home.lan
dhcp-range=192.168.100.2,192.168.100.199,255.255.255.0,48h
dhcp-option=option:router,192.168.100.1
dhcp-option=option:dns-server,192.168.100.200
dhcp-option=option:ntp-server,192.168.100.200
```

Here _192.168.100.1_ is the IP address to my router, _192.168.100.200_ is my own IP address we set up in the beginning of the section and I declare that we use the range _192.168.100.2_ to _192.168.100.199_ for DHCP. If your router and network uses different address ranges, either edit the file accordingly or edit the IP address of your router to match these settings and use my config file straight off.

Since I'm too lazy (and don't think too many people will read this) I'm not gonna explain all lines of this configuration. Just take notice that we are setting up our router and ourselves to be the two key players in this network. Also note that we are referencing an external file for our spoofed hosts, this way the configuration get less cluttered.

Now let's edit that list of spoofed hosts I was talking about. Fire up an editor for _/etc/dnsmasq.spoofed.hosts_
```
sudo nano /etc/dnsmasq.spoofed.hosts
```

Here you declare all IP <-> domain translations you want. In my case I noticed my cameras were referencing the following domains, and hence I pointed them in the direction of this device (see IP as in last example, edit if you used something else).
```
192.168.100.200 1.cn.pool.ntp.org
192.168.100.200 time.windows.com
192.168.100.200 de.ntp.org.cn
192.168.100.200 jp.ntp.org.cn
```

That should be all changes you need to get it functional. One last tip! To see what leases have been issued by the dnsmasq DHCP server, run
```
cat /var/lib/misc/dnsmasq.leases
```

### Finalizing everything
One final step! Before everything works you need to do two things: restart the dnsmasq server in order for it to read the new configurations and disable the DHCP server on your router (since our device now handles DHCP in the network instead). I usually do this by bringing up the web configuration page with DHCP options to be ready, then I restart the device we just set up with ```sudo reboot``` and quickly turn off DHCP on the router and apply the settings. This way I get no switch-over time between the devices (and hence no weird conflicts between them).

### Testing that it works
To test that it works, disconnect from the network and then reconnect. If it works, you should have gotten an IP address from our newly configured device. You can also ping one of the devices in devices in your spoofed list to make sure the DNS spoofing have kicked in. For example for me pinging _jp.ntp.org.cn_ looks like this:
```
matz@matz-pc:~$ ping jp.ntp.org.cn
PING jp.ntp.org.cn (192.168.100.200) 56(84) bytes of data.
64 bytes from 1.cn.pool.ntp.org (192.168.100.200): icmp_seq=1 ttl=64 time=2.58 ms
64 bytes from 1.cn.pool.ntp.org (192.168.100.200): icmp_seq=2 ttl=64 time=3.88 ms
64 bytes from 1.cn.pool.ntp.org (192.168.100.200): icmp_seq=3 ttl=64 time=3.97 ms
^C
--- jp.ntp.org.cn ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2002ms
rtt min/avg/max/mdev = 2.579/3.474/3.965/0.633 ms
```

You can see that the correct device responded (192.168.100.200) and not the ACTUAL servers responsible for _jp.ntp.org.cn_. Yay!


## Interesting notes

### If you want to stop using this device in your network...
Note that if you ever want to remove this device from the network you will have to turn on DHCP on your router again. If you disconnect the device before doing this, your computer/phone trying to connect to the network will not get an IP address and hence will not be able to connect properly. To get around this, set a static IP address for your computer/phone and all should be fine. Now you can access the router to configure it. Hopefully that made sense. 